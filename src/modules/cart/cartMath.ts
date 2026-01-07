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

/**
 * Build cart entries from cart state and offers
 * Optimized: Uses Map for O(1) lookup instead of O(n) find
 */
export function buildCartEntries(
  cart: CartState,
  offers: Offer[]
): CartEntry[] {
  // Create a Map for O(1) lookup instead of O(n) find in loop
  const offerMap = new Map<OfferId, Offer>();
  for (const offer of offers) {
    offerMap.set(offer.id, offer);
  }

  const entries: CartEntry[] = [];
  for (const [offerId, quantity] of Object.entries(cart)) {
    const offer = offerMap.get(offerId);
    if (!offer) continue; // Skip if offer not found

    const lineTotal = offer.price * quantity;
    const lineOldPrice = offer.oldPrice ? offer.oldPrice * quantity : undefined;
    entries.push({ offer, quantity, lineTotal, lineOldPrice });
  }

  return entries;
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

