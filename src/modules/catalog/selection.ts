import type {
  BaseItemId,
  CategoryId,
  SubcategoryId,
} from "./types";
import type { CatalogIndexes } from "./indexes";

export type Selection = {
  categoryId: CategoryId | null;
  subcategoryId: SubcategoryId | null;
  itemId: BaseItemId | null;
};

/**
 * Ensures that subcategory and item belong to the current category/subcategory.
 * Mirrors the client behaviour used on the catalog page.
 */
export function ensureValidSelection(
  selection: Selection,
  indexes: CatalogIndexes
): Selection {
  const { categoryId } = selection;
  let nextSubcategoryId = selection.subcategoryId;
  let nextItemId = selection.itemId;

  if (categoryId) {
    const subs = indexes.subcategoriesByCategory.get(categoryId) ?? [];
    if (subs.length === 0) {
      nextSubcategoryId = null;
      nextItemId = null;
    } else if (!subs.some((s) => s.id === nextSubcategoryId)) {
      nextSubcategoryId = subs[0].id;
    }
  }

  if (nextSubcategoryId) {
    const items = indexes.itemsBySubcategory.get(nextSubcategoryId) ?? [];
    if (items.length === 0) {
      nextItemId = null;
    } else if (nextItemId == null) {
      // User hasn't chosen a 3rd-level category yet; keep it unselected.
      nextItemId = null;
    } else if (!items.some((i) => i.id === nextItemId)) {
      nextItemId = items[0].id;
    }
  }

  return {
    categoryId,
    subcategoryId: nextSubcategoryId,
    itemId: nextItemId,
  };
}

