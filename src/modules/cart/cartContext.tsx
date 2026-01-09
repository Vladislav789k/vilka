"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { buildCartEntries, calculateTotals, updateCartQuantity } from "./cartMath";
import type { CartState, CartEntry, CartTotals } from "./types";
import type { Offer, OfferId } from "../catalog/types";

type CartContextValue = {
  cart: CartState;
  quantities: CartState;
  entries: CartEntry[];
  totals: CartTotals;
  offerStocks: Record<OfferId, number | undefined>;
  add: (offerId: OfferId) => void;
  remove: (offerId: OfferId) => void;
  removeLine: (offerId: OfferId) => void;
  reload: () => Promise<void>;
  lastServerMessages: string[];
};

const CartContext = createContext<CartContextValue | null>(null);

type CartProviderProps = PropsWithChildren<{
  offers: Offer[];
}>;

export function CartProvider({ offers, children }: CartProviderProps) {
  const [cart, setCart] = useState<CartState>({});
  const [offerStocks, setOfferStocks] = useState<Record<OfferId, number | undefined>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastServerMessages, setLastServerMessages] = useState<string[]>([]);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const syncRequestIdRef = useRef(0);
  const syncAbortRef = useRef<AbortController | null>(null);
  const lastServerMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadCartFromServer = useRef(
    async (opts?: { mergeIfHasExisting?: boolean }) => {
      const mergeIfHasExisting = opts?.mergeIfHasExisting ?? false;

      // Skip if not in browser
      if (typeof window === "undefined") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log("[CartProvider] Loading cart from server");
        const transientStatuses = new Set([502, 503, 504]);
        let res: Response | null = null;
        let lastErr: unknown = null;

        // Retry a few times for transient proxy/startup failures (e.g. nginx 502 during initial compile)
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            res = await fetch("/api/cart/load", { method: "GET" });
            if (!transientStatuses.has(res.status)) break;
          } catch (e) {
            lastErr = e;
          }

          const backoffMs = 250 * (attempt + 1);
          await new Promise((r) => setTimeout(r, backoffMs));
        }

        if (!res) {
          console.warn("[CartProvider] Failed to load cart (no response). Last error:", lastErr);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          console.log("[CartProvider] Cart loaded from server:", data);

          const quantities: CartState = {};
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              const stringId = String(item.offerId);
              quantities[stringId] = item.quantity;
              console.log(
                `[CartProvider] Loading item: ${item.offerId} (number) -> "${stringId}" (string), qty: ${item.quantity}`
              );
            }
          }

          if (mergeIfHasExisting) {
            setCart((prev) => {
              const hasExistingItems = Object.values(prev).some((qty) => qty > 0);
              if (hasExistingItems) {
                console.log("[CartProvider] Merging loaded cart with existing items:", prev, "+", quantities);
                return { ...prev, ...quantities };
              }
              return quantities;
            });
          } else {
            // IMPORTANT: replace state (used after auth changes) to avoid syncing stale/empty cart over user cart
            setCart(quantities);
          }
        } else {
          if (transientStatuses.has(res.status)) {
            console.warn("[CartProvider] Failed to load cart after retries (transient):", res.status);
          } else {
            console.error("[CartProvider] Failed to load cart:", res.status);
          }
        }
      } catch (err) {
        console.error("[CartProvider] Error loading cart:", err);
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          console.warn("[CartProvider] Network error - continuing with current cart");
        }
      } finally {
        setIsLoading(false);
      }
    }
  );

  // Загружаем корзину из Redis при монтировании
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadCartFromServer.current({ mergeIfHasExisting: true });
  }, []);

  const syncWithServer = useRef(async (quantities: CartState) => {
    console.log("[CartProvider] syncWithServer called with quantities:", quantities);
    
    // Каждый новый sync делает предыдущий устаревшим: абортим in-flight запрос,
    // а ответы от старых запросов игнорируем (иначе возможны "откаты" счётчиков).
    const requestId = ++syncRequestIdRef.current;
    if (syncAbortRef.current) {
      try {
        syncAbortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    syncAbortRef.current = controller;

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([offerId, quantity]) => {
        const numId = Number(offerId);
        console.log(`[CartProvider] Converting offerId "${offerId}" (${typeof offerId}) to ${numId} (${typeof numId})`);
        return {
          offerId: numId,
          quantity,
        };
      });

    console.log("[CartProvider] Prepared items for sync:", items);

    // Проверка isLoading уже выполнена в useEffect перед вызовом этой функции

    try {
      console.log("[CartProvider] Syncing cart with", items.length, "items", JSON.stringify(items, null, 2));
      const transientStatuses = new Set([502, 503, 504]);
      let res: Response | null = null;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          res = await fetch("/api/cart/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deliverySlot: null,
              items,
            }),
            signal: controller.signal,
          });
          if (!transientStatuses.has(res.status)) break;
        } catch (e) {
          if (controller.signal.aborted) {
            console.log("[CartProvider] Cart sync aborted (newer sync started)");
            return;
          }
          lastErr = e;
        }

        const backoffMs = 250 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      if (!res) {
        console.warn("[CartProvider] Cart sync failed (no response). Last error:", lastErr);
        return;
      }

      // Если пока мы ждали ответ, стартовал новый sync — игнорируем этот результат.
      if (requestId !== syncRequestIdRef.current) {
        console.log("[CartProvider] Ignoring stale cart sync response", { requestId, latest: syncRequestIdRef.current });
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (transientStatuses.has(res.status)) {
          console.warn("[CartProvider] Cart sync failed after retries (transient)", res.status, errorData);
        } else {
          console.error("[CartProvider] Cart sync failed", res.status, errorData);
        }
        // Не обновляем состояние при ошибке
        return;
      }
      
      const data = await res.json();
      console.log("[CartProvider] Cart synced successfully:", data);
      console.log("[CartProvider] Received items:", data.items);

      // Ещё раз защищаемся от гонок: на случай если новый sync стартовал между res.ok и res.json().
      if (requestId !== syncRequestIdRef.current) {
        console.log("[CartProvider] Ignoring stale cart sync payload", { requestId, latest: syncRequestIdRef.current });
        return;
      }

      // Защита от "тихих" откатов:
      // если сервер вернул количества, отличающиеся от отправленных, но при этом НЕ прислал changes для этих offerId,
      // считаем ответ неконсистентным/устаревшим и не применяем его.
      const changedOfferIds = new Set<string>();
      if (data.changes && Array.isArray(data.changes)) {
        for (const ch of data.changes as any[]) {
          if (ch && ch.offerId != null) changedOfferIds.add(String(ch.offerId));
        }
      }
      const requestedQtyByOfferId = new Map<string, number>();
      for (const it of items) {
        requestedQtyByOfferId.set(String(it.offerId), it.quantity);
      }
      
      // Проверяем, есть ли изменения (удаленные товары)
      if (data.changes && Array.isArray(data.changes) && data.changes.length > 0) {
        console.warn("[CartProvider] Items were removed:", data.changes);

        const messages = (data.changes as any[])
          .map((c) => (c && typeof c.message === "string" ? c.message : null))
          .filter(Boolean) as string[];
        if (messages.length > 0) {
          setLastServerMessages(messages.slice(0, 3));
          if (lastServerMessagesTimeoutRef.current) {
            clearTimeout(lastServerMessagesTimeoutRef.current);
          }
          lastServerMessagesTimeoutRef.current = setTimeout(() => {
            setLastServerMessages([]);
          }, 4000);
        }
      }
      
      // Обновляем локальное состояние из ответа сервера
      // Важно: сервер возвращает числовые offerId, но в CartState ключи - строки
      const serverQuantities: CartState = {};
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          // Конвертируем числовой ID обратно в строку для CartState
          const stringId = String(item.offerId);
          serverQuantities[stringId] = item.quantity;
          console.log(`[CartProvider] Mapping server item: ${item.offerId} (number) -> "${stringId}" (string), qty: ${item.quantity}`);
        }
      }

      for (const [k, requestedQty] of requestedQtyByOfferId.entries()) {
        const serverQty = serverQuantities[k] ?? 0;
        if (serverQty !== requestedQty && !changedOfferIds.has(k)) {
          console.warn("[CartProvider] Ignoring inconsistent cart sync response (mismatch without changes)", {
            offerId: k,
            requestedQty,
            serverQty,
          });
          return;
        }
      }

      // Обновляем локальную карту остатков (если сервер её прислал)
      if (data.stockByOfferId && typeof data.stockByOfferId === "object") {
        const nextStocks: Record<OfferId, number | undefined> = {};
        for (const [k, v] of Object.entries(data.stockByOfferId as Record<string, unknown>)) {
          const stringId = String(k) as OfferId;
          const num = typeof v === "number" ? v : Number(v);
          nextStocks[stringId] = Number.isFinite(num) ? num : undefined;
        }
        setOfferStocks((prev) => ({ ...prev, ...nextStocks }));
      }
      
      console.log("[CartProvider] Updating cart state from server:", serverQuantities);
      console.log("[CartProvider] Previous cart state:", cart);
      
      // Используем функциональное обновление, чтобы не потерять изменения
      setCart((prev) => {
        // Объединяем предыдущее состояние с серверным, приоритет у сервера.
        // ВАЖНО: не удаляем "лишние" позиции только потому, что их нет в ответе —
        // это может откатить счётчик, если пользователь успел изменить корзину после отправки запроса.
        const merged: CartState = { ...prev, ...serverQuantities };

        // Удаляем только то, что сервер явно попросил удалить (например, товара больше нет/нельзя заказать).
        if (data.changes && Array.isArray(data.changes)) {
          for (const ch of data.changes as any[]) {
            if (ch && ch.type === "removed" && ch.offerId != null) {
              const k = String(ch.offerId);
              if (k in merged) {
                delete merged[k];
              }
            }
          }
        }

        console.log("[CartProvider] Merged cart state:", merged);
        return merged;
      });
    } catch (err) {
      console.error("[CartProvider] Cart sync error:", err);
    }
  });

  // Автоматическая синхронизация при изменении корзины (debounced)
  useEffect(() => {
    // Пропускаем синхронизацию во время начальной загрузки
    if (isLoading) {
      console.log("[CartProvider] Skipping sync effect - still loading (isLoading:", isLoading, ")");
      return;
    }

    // Корзину синхронизируем даже если она стала пустой —
    // это важно для корректного "возврата" остатков в БД и очистки Redis-состояния.

    // Очищаем предыдущий таймаут
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    console.log("[CartProvider] Scheduling sync for cart:", cart, "isLoading:", isLoading);
    
    // Устанавливаем новый таймаут для синхронизации (500ms debounce)
    syncTimeoutRef.current = setTimeout(() => {
      // Проверяем isLoading еще раз при вызове, так как он мог измениться
      // Но мы уже проверили его в useEffect, так что просто вызываем синхронизацию
      console.log("[CartProvider] Executing scheduled sync");
      syncWithServer.current(cart);
    }, 500);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [cart, isLoading]);

  const add = (offerId: OfferId) =>
    setCart((prev) => updateCartQuantity(prev, offerId, 1));
  const remove = (offerId: OfferId) =>
    setCart((prev) => updateCartQuantity(prev, offerId, -1));
  const removeLine = (offerId: OfferId) =>
    setCart((prev) => {
      const { [offerId]: _removed, ...rest } = prev;
      return rest;
    });
  const reload = async () => loadCartFromServer.current({ mergeIfHasExisting: false });

  const entries = useMemo(() => buildCartEntries(cart, offers), [cart, offers]);
  const totals = useMemo(() => calculateTotals(entries), [entries]);

  const value: CartContextValue = useMemo(
    () => ({
      cart,
      quantities: cart,
      entries,
      totals,
      offerStocks,
      add,
      remove,
      removeLine,
      reload,
      lastServerMessages,
    }),
    [cart, entries, totals, offerStocks, lastServerMessages]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

