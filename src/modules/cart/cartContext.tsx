"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { buildCartEntries, calculateTotals, updateCartQuantity } from "./cartMath";
import type { CartState, CartEntry, CartTotals } from "./types";
import type { Offer, OfferId } from "../catalog/types";
import { apiClient, devLog, devError, devWarn } from "@/lib/apiClient";

type CartContextValue = {
  cart: CartState;
  quantities: CartState;
  entries: CartEntry[];
  totals: CartTotals;
  offerStocks: Record<OfferId, number | undefined>;
  add: (offerId: OfferId) => void;
  remove: (offerId: OfferId) => void;
  reload: () => Promise<void>;
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
  const didWarnNetworkErrorRef = useRef(false);

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
        const data = await apiClient.get<{ items?: Array<{ offerId: number; quantity: number }> }>(
          "/api/cart/load",
          {
            retry: {
              maxRetries: 3,
              retryDelays: [300, 500, 800],
            },
          }
        );

        devLog("Cart loaded from server", { itemsCount: data.items?.length || 0 });

        const quantities: CartState = {};
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            const stringId = String(item.offerId);
            quantities[stringId] = item.quantity;
          }
        }

        if (mergeIfHasExisting) {
          setCart((prev) => {
            const hasExistingItems = Object.values(prev).some((qty) => qty > 0);
            if (hasExistingItems) {
              return { ...prev, ...quantities };
            }
            return quantities;
          });
        } else {
          // IMPORTANT: replace state (used after auth changes) to avoid syncing stale/empty cart over user cart
          setCart(quantities);
        }

        // Reset warning flag on success
        didWarnNetworkErrorRef.current = false;
      } catch (err) {
        // Handle errors gracefully - apiClient already retried
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          // Only warn once per page load
          if (!didWarnNetworkErrorRef.current) {
            didWarnNetworkErrorRef.current = true;
            devWarn("Network error loading cart - continuing with empty cart");
          }
        } else {
          devError("Error loading cart:", err);
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
    // Skip sync if we're not in the browser
    if (typeof window === "undefined") {
      return;
    }

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([offerId, quantity]) => {
        const numId = Number(offerId);
        return {
          offerId: numId,
          quantity,
        };
      });

    // Skip if no items to sync
    if (items.length === 0 && Object.keys(quantities).length === 0) {
      return;
    }

    devLog("Syncing cart", { itemsCount: items.length });

    try {
      const data = await apiClient.post<{
        items?: Array<{ offerId: number; quantity: number }>;
        changes?: any[];
        stockByOfferId?: Record<number, number>;
      }>("/api/cart/validate", {
        body: {
          deliverySlot: null,
          items,
        },
        retry: {
          maxRetries: 3,
          retryDelays: [300, 500, 800],
        },
      });

      devLog("Cart synced successfully", { itemsCount: data.items?.length || 0 });

      // Reset warning flag on success
      didWarnNetworkErrorRef.current = false;

      // Проверяем, есть ли изменения (удаленные товары)
      if (data.changes && Array.isArray(data.changes) && data.changes.length > 0) {
        devWarn("Items were removed:", data.changes);
      }

      // Обновляем локальное состояние из ответа сервера
      // Важно: сервер возвращает числовые offerId, но в CartState ключи - строки
      const serverQuantities: CartState = {};
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          // Конвертируем числовой ID обратно в строку для CartState
          const stringId = String(item.offerId);
          serverQuantities[stringId] = item.quantity;
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

      // Обновляем корзину из ответа сервера (это важно для синхронизации с другими вкладками/устройствами)
      setCart(serverQuantities);
    } catch (err) {
      // Handle errors gracefully - apiClient already retried
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        // After max retries, log warning once per page load
        if (!didWarnNetworkErrorRef.current) {
          didWarnNetworkErrorRef.current = true;
          devWarn(
            "Network error during cart sync after retries. Continuing with local cart state. This is normal during app startup."
          );
        }
        return;
      }
      // Other errors - log in dev mode
      devError("Error syncing cart:", err);
    }
  });

  // Автоматическая синхронизация при изменении корзины (debounced)
  useEffect(() => {
    // Пропускаем синхронизацию во время начальной загрузки
    if (isLoading) {
      return;
    }

    // Корзину синхронизируем даже если она стала пустой —
    // это важно для корректного "возврата" остатков в БД и очистки Redis-состояния.

    // Очищаем предыдущий таймаут
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Устанавливаем новый таймаут для синхронизации (500ms debounce)
    syncTimeoutRef.current = setTimeout(() => {
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
      reload,
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


