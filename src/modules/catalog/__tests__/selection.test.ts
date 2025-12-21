import { buildCatalogIndexes } from "../indexes";
import { ensureValidSelection } from "../selection";
import type { CatalogData } from "../types";

const catalog: CatalogData = {
  categories: [
    { id: "cat-a", name: "Cat A" },
    { id: "cat-b", name: "Cat B" },
  ],
  subcategories: [
    { id: "cat-a:sub1", name: "Sub 1", categoryId: "cat-a" },
    { id: "cat-b:sub1", name: "Sub 2", categoryId: "cat-b" },
  ],
  baseItems: [
    {
      id: "item-1",
      name: "Item 1",
      description: "",
      categoryId: "cat-a",
      subcategoryId: "cat-a:sub1",
    },
    {
      id: "item-2",
      name: "Item 2",
      description: "",
      categoryId: "cat-b",
      subcategoryId: "cat-b:sub1",
    },
  ],
  offers: [],
};

describe("catalog selection helpers", () => {
  const indexes = buildCatalogIndexes(catalog);

  it("keeps valid subcategory/item for the chosen category", () => {
    const next = ensureValidSelection(
      { categoryId: "cat-a", subcategoryId: "cat-a:sub1", itemId: "item-1" },
      indexes
    );
    expect(next).toEqual({
      categoryId: "cat-a",
      subcategoryId: "cat-a:sub1",
      itemId: "item-1",
    });
  });

  it("switches to the first subcategory when current one does not belong to category", () => {
    const next = ensureValidSelection(
      { categoryId: "cat-a", subcategoryId: "cat-b:sub1", itemId: "item-2" },
      indexes
    );
    expect(next.subcategoryId).toBe("cat-a:sub1");
    expect(next.itemId).toBe("item-1");
  });

  it("drops item when subcategory has no items", () => {
    const sparseCatalog: CatalogData = {
      ...catalog,
      baseItems: [],
    };
    const sparseIndexes = buildCatalogIndexes(sparseCatalog);
    const next = ensureValidSelection(
      { categoryId: "cat-a", subcategoryId: "cat-a:sub1", itemId: "item-1" },
      sparseIndexes
    );
    expect(next.itemId).toBeNull();
  });

  it("keeps item empty when user has not chosen a 3rd-level category yet", () => {
    const next = ensureValidSelection(
      { categoryId: "cat-a", subcategoryId: "cat-a:sub1", itemId: null },
      indexes
    );
    expect(next).toEqual({
      categoryId: "cat-a",
      subcategoryId: "cat-a:sub1",
      itemId: null,
    });
  });
});

