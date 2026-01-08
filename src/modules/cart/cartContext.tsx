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
};

const CartContext = createContext<CartContextValue | null>(null);

type CartProviderProps = PropsWithChildren<{
  offers: Offer[];
}>;

export function CartProvider({ offers, children }: CartProviderProps) {
  const [cart, setCart] = useState<CartState>({});
  const [offerStocks, setOfferStocks] = useState<Record<OfferId, number | undefined>>({});
  const [isLoading, setIsLoading] = useState(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);

  // Загружаем корзину из Redis при монтировании
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadCart = async () => {
      try {
        console.log("[CartProvider] Loading cart from server");
        const res = await fetch("/api/cart/load", {
          method: "GET",
        });

        if (res.ok) {
          const data = await res.json();
          console.log("[CartProvider] Cart loaded from server:", data);
          
          // Преобразуем items из сервера в CartState
          // Важно: сервер возвращает числовые offerId, но в CartState ключи - строки
          const quantities: CartState = {};
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              const stringId = String(item.offerId);
              quantities[stringId] = item.quantity;
              console.log(`[CartProvider] Loading item: ${item.offerId} (number) -> "${stringId}" (string), qty: ${item.quantity}`);
            }
          }
          
          // Устанавливаем состояние, но не триггерим синхронизацию
          // Используем функциональное обновление, чтобы не перезаписать товары, добавленные во время загрузки
          setCart((prev) => {
            // Если корзина уже содержит товары (добавленные во время загрузки), сохраняем их
            const hasExistingItems = Object.values(prev).some(qty => qty > 0);
            if (hasExistingItems) {
              console.log("[CartProvider] Merging loaded cart with existing items:", prev, "+", quantities);
              // Объединяем: приоритет у загруженных данных, но если есть новые товары - сохраняем их
              return { ...prev, ...quantities };
            }
            return quantities;
          });
          console.log("[CartProvider] Cart state updated from server:", quantities);
        } else {
          console.error("[CartProvider] Failed to load cart:", res.status);
        }
      } catch (err) {
        console.error("[CartProvider] Error loading cart:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, []);

  const syncWithServer = useRef(async (quantities: CartState) => {
    console.log("[CartProvider] syncWithServer called with quantities:", quantities);
    
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
      const res = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverySlot: null,
          items,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[CartProvider] Cart sync failed", res.status, errorData);
        // Не обновляем состояние при ошибке
        return;
      }
      
      const data = await res.json();
      console.log("[CartProvider] Cart synced successfully:", data);
      console.log("[CartProvider] Received items:", data.items);
      
      // Проверяем, есть ли изменения (удаленные товары)
      if (data.changes && Array.isArray(data.changes) && data.changes.length > 0) {
        console.warn("[CartProvider] Items were removed:", data.changes);
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
        // Объединяем предыдущее состояние с серверным, приоритет у сервера
        const merged = { ...prev, ...serverQuantities };
        // Удаляем товары, которых нет в серверном ответе (если они были удалены)
        for (const key in merged) {
          if (!(key in serverQuantities) && prev[key] > 0) {
            console.log(`[CartProvider] Removing item ${key} from cart (not in server response)`);
            delete merged[key];
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
    }),
    [cart, entries, totals, offerStocks]
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

