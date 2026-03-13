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
  const wsRef = useRef<WebSocket | null>(null);
  const wsLastTsRef = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const syncRequestIdRef = useRef(0);
  const syncAbortRef = useRef<AbortController | null>(null);
  const lastServerMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const applyServerCartPayload = useRef((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const record = payload as Record<string, unknown>;
    const items = Array.isArray(record.items)
      ? record.items
      : record.cart && typeof record.cart === "object" && Array.isArray((record.cart as Record<string, unknown>).items)
      ? ((record.cart as Record<string, unknown>).items as unknown[])
      : [];

    const serverQuantities: CartState = {};
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const itemRecord = item as Record<string, unknown>;
      const offerId = itemRecord.offerId;
      const quantity = itemRecord.quantity;
      if (offerId == null || quantity == null) continue;
      const stringId = String(offerId) as OfferId;
      const qtyNum = typeof quantity === "number" ? quantity : Number(quantity);
      if (Number.isFinite(qtyNum) && qtyNum > 0) {
        serverQuantities[stringId] = qtyNum;
      }
    }

    setCart(serverQuantities);

    const stockPayload =
      record.stockByOfferId && typeof record.stockByOfferId === "object"
        ? (record.stockByOfferId as Record<string, unknown>)
        : null;
    if (stockPayload) {
      const nextStocks: Record<OfferId, number | undefined> = {};
      for (const [k, v] of Object.entries(stockPayload)) {
        const stringId = String(k) as OfferId;
        const num = typeof v === "number" ? v : Number(v);
        nextStocks[stringId] = Number.isFinite(num) ? num : undefined;
      }
      setOfferStocks((prev) => ({ ...prev, ...nextStocks }));
    }

    const changePayload = Array.isArray(record.changes) ? record.changes : [];
    const messages = changePayload
      .map((change) =>
        change && typeof change === "object" && typeof (change as Record<string, unknown>).message === "string"
          ? ((change as Record<string, unknown>).message as string)
          : null
      )
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
  });

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
            applyServerCartPayload.current(data);
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

  const sendCartOverWs = useRef((quantities: CartState) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([offerId, quantity]) => ({ offerId: Number(offerId), quantity }));

    try {
      ws.send(JSON.stringify({ type: "cart:sync", deliverySlot: null, items }));
      return true;
    } catch {
      return false;
    }
  });

  // Загружаем корзину из Redis при монтировании
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    (async () => {
      await loadCartFromServer.current({ mergeIfHasExisting: true });

      // After first server call, cookies (vilka_cart / vilka_user_id) are present.
      // Subscribe to realtime updates via WebSocket.
      if (typeof window === "undefined") return;
      if (wsRef.current) return;

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/ws/cart`;
      console.log("[CartProvider] Connecting cart WS:", url);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: unknown = null;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object" || (msg as { type?: string }).type !== "cart:update") return;
        const ts = typeof msg.ts === "number" ? msg.ts : 0;
        if (ts && ts <= wsLastTsRef.current) return;
        if (ts) wsLastTsRef.current = ts;

        applyServerCartPayload.current(msg);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        console.log("[CartProvider] Cart WS closed");
      };

      ws.onerror = (e) => {
        console.warn("[CartProvider] Cart WS error", e);
      };
    })();
  }, []);

  const syncWithServer = useRef(async (quantities: CartState) => {
    console.log("[CartProvider] syncWithServer called with quantities:", quantities);
    // Prefer WS: no /api/cart/validate requests from the browser.
    if (typeof window !== "undefined") {
      const ok = sendCartOverWs.current(quantities);
      if (ok) return;
    }

    // Fallback: if WS isn't connected, keep old behavior (rare; mostly during startup).
    // This is intentionally kept minimal to avoid breaking cart in environments without WS.
    try {
      const res = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverySlot: null,
          items: Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([offerId, quantity]) => ({ offerId: Number(offerId), quantity })),
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          applyServerCartPayload.current(data);
        }
      } else {
        console.warn("[CartProvider] Cart sync fallback returned status:", res.status);
      }
    } catch (err) {
      console.warn("[CartProvider] Cart sync fallback failed", err);
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

