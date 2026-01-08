import type { CartEntry, CartState, CartTotals } from "./types";
import type { Offer, OfferId } from "../catalog/types";

export function updateCartQuantity(
  cart: CartState,
  offerId: OfferId,
  delta: number
): CartState {
  const nextQty = (cart[offerId] ?? 0) + delta;
  if (nextQty <= 0) {
    const { [offerId]: _removed, ...rest } = cart;
    return rest;
  }
  return { ...cart, [offerId]: nextQty };
}

export function buildCartEntries(
  cart: CartState,
  offers: Offer[]
): CartEntry[] {
  return Object.entries(cart)
    .map(([offerId, quantity]) => {
      const offer = offers.find((o) => o.id === offerId);
      if (!offer) return null;
      const lineTotal = offer.price * quantity;
      const lineOldPrice = offer.oldPrice ? offer.oldPrice * quantity : undefined;
      return { offer, quantity, lineTotal, lineOldPrice };
    })
    .filter((x): x is CartEntry => x !== null);
}

export function calculateTotals(entries: CartEntry[]): CartTotals {
  return entries.reduce<CartTotals>(
    (acc, entry) => ({
      totalCount: acc.totalCount + entry.quantity,
      totalPrice: acc.totalPrice + entry.lineTotal,
    }),
    { totalCount: 0, totalPrice: 0 }
  );
}

