import { buildCartEntries, calculateTotals, updateCartQuantity } from "../cartMath";
import type { Offer } from "../../catalog/types";

const offers: Offer[] = [
  {
    id: "1",
    baseItemId: "b1",
    restaurantId: 1,
    isAnonymous: false,
    brand: "Brand",
    price: 200,
    oldPrice: 250,
    tag: undefined,
    etaMinutes: undefined,
    imageUrl: null,
    menuItemName: "Item 1",
    stock: 10,
  },
  {
    id: "2",
    baseItemId: "b2",
    restaurantId: 2,
    isAnonymous: true,
    price: 100,
    oldPrice: undefined,
    tag: undefined,
    etaMinutes: undefined,
    imageUrl: null,
    menuItemName: "Item 2",
    stock: 10,
  },
];

describe("cartMath", () => {
  it("updates quantities and removes zeroed items", () => {
    const afterAdd = updateCartQuantity({}, "1", 1);
    expect(afterAdd).toEqual({ "1": 1 });

    const afterMore = updateCartQuantity(afterAdd, "1", 2);
    expect(afterMore["1"]).toBe(3);

    const afterRemove = updateCartQuantity(afterMore, "1", -3);
    expect(afterRemove).toEqual({});
  });

  it("builds cart entries with discounts", () => {
    const cart = { "1": 2, "2": 1 };
    const entries = buildCartEntries(cart, offers);
    expect(entries).toHaveLength(2);

    const discounted = entries.find((e) => e.offer.id === "1")!;
    expect(discounted.lineTotal).toBe(400);
    expect(discounted.lineOldPrice).toBe(500);
  });

  it("calculates totals", () => {
    const cart = { "1": 1, "2": 3 };
    const entries = buildCartEntries(cart, offers);
    const totals = calculateTotals(entries);
    expect(totals.totalCount).toBe(4);
    expect(totals.totalPrice).toBe(200 + 300);
  });
});

