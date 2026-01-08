import { query } from "@/lib/db";
import type { CatalogData, Category, Subcategory, BaseItem, Offer } from "./types";

type CatalogRow = {
  menu_item_id: number;
  restaurant_id: number;
  restaurant_name: string;
  menu_item_name: string;
  composition: string | null;
  price: number;
  discount_percent: number | null;
  image_url: string | null;
  is_brand_anonymous: boolean;
  stock_qty: number;
  ref_category_id: number;
  category_level: number;
  level1_code: string | null;
  level1_name: string | null;
  level2_code: string | null;
  level2_name: string | null;
  level3_code: string | null;
  level3_name: string | null;
};

export async function getCatalogData(): Promise<CatalogData> {
  const { rows } = await query<CatalogRow>(
    `
    SELECT
      mi.id                 AS menu_item_id,
      mi.restaurant_id      AS restaurant_id,
      r.name                AS restaurant_name,
      mi.name               AS menu_item_name,
      mi.composition        AS composition,
      mi.price              AS price,
      mi.discount_percent   AS discount_percent,
      mi.image_url          AS image_url,
      mi.is_brand_anonymous AS is_brand_anonymous,
      mi.stock_qty          AS stock_qty,
      c.id                  AS ref_category_id,
      c.level               AS category_level,
      CASE
        WHEN c.level = 1 THEN c.code
        WHEN c.level = 2 THEN p1.code
        WHEN c.level = 3 THEN p2.code
        ELSE NULL
      END AS level1_code,
      CASE
        WHEN c.level = 1 THEN c.name
        WHEN c.level = 2 THEN p1.name
        WHEN c.level = 3 THEN p2.name
        ELSE NULL
      END AS level1_name,
      CASE
        WHEN c.level = 2 THEN c.code
        WHEN c.level = 3 THEN p1.code
        ELSE NULL
      END AS level2_code,
      CASE
        WHEN c.level = 2 THEN c.name
        WHEN c.level = 3 THEN p1.name
        ELSE NULL
      END AS level2_name,
      CASE
        WHEN c.level = 3 THEN c.code
        ELSE NULL
      END AS level3_code,
      CASE
        WHEN c.level = 3 THEN c.name
        ELSE NULL
      END AS level3_name
    FROM menu_items mi
    JOIN restaurants r
      ON r.id = mi.restaurant_id
    JOIN ref_dish_categories c
      ON c.id = mi.ref_category_id
    LEFT JOIN ref_dish_categories p1
      ON p1.id = c.parent_id
    LEFT JOIN ref_dish_categories p2
      ON p2.id = p1.parent_id
    WHERE mi.is_active = TRUE
      AND c.is_active = TRUE
      AND c.level BETWEEN 1 AND 3
    ORDER BY
      COALESCE(
        CASE
          WHEN c.level = 1 THEN c.name
          WHEN c.level = 2 THEN p1.name
          WHEN c.level = 3 THEN p2.name
        END,
        'Другое'
      ),
      COALESCE(
        CASE
          WHEN c.level = 2 THEN c.name
          WHEN c.level = 3 THEN p1.name
        END,
        ''
      ),
      COALESCE(
        CASE
          WHEN c.level = 3 THEN c.name
        END,
        ''
      ),
      mi.price
    `
  );

  const categoryMap = new Map<string, Category>();
  const subcategoryMap = new Map<string, Subcategory>();
  const baseItemMap = new Map<string, BaseItem>();
  const offers: Offer[] = [];

  for (const row of rows) {
    const level1Code =
      row.level1_code ?? row.level2_code ?? row.level3_code ?? "other-l1";
    const level1Name =
      row.level1_name ??
      row.level2_name ??
      row.level3_name ??
      "Другое";

    const hasLevel2 = !!row.level2_code;
    const hasLevel3 = !!row.level3_code;

    const categoryId = level1Code;

    const subcategoryId = hasLevel2
      ? `${categoryId}:${row.level2_code}`
      : `${categoryId}:${categoryId}-self`;
    const subcategoryName = hasLevel2
      ? row.level2_name ?? "Прочее"
      : level1Name;

    const baseItemId = String(row.ref_category_id);
    const baseItemName =
      (hasLevel3
        ? row.level3_name
        : hasLevel2
        ? row.level2_name
        : row.level1_name) ?? row.menu_item_name;

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: categoryId,
        name: level1Name,
      });
    }

    if (!subcategoryMap.has(subcategoryId)) {
      subcategoryMap.set(subcategoryId, {
        id: subcategoryId,
        name: subcategoryName,
        categoryId,
      });
    }

    if (!baseItemMap.has(baseItemId)) {
      baseItemMap.set(baseItemId, {
        id: baseItemId,
        name: baseItemName,
        description:
          row.composition ??
          `Блюдо категории «${subcategoryName.toLowerCase()}»`,
        categoryId,
        subcategoryId,
      });
    }

    let finalPrice = row.price;
    let oldPrice: number | undefined;

    if (row.discount_percent != null && row.discount_percent > 0) {
      oldPrice = row.price;
      finalPrice = Math.round(row.price * (1 - row.discount_percent / 100));
    }

    offers.push({
      id: String(row.menu_item_id),
      baseItemId,
      isAnonymous: row.is_brand_anonymous,
      brand: row.is_brand_anonymous ? undefined : row.restaurant_name,
      price: finalPrice,
      oldPrice,
      tag: undefined,
      etaMinutes: undefined,
      imageUrl: row.image_url,
      menuItemName: row.menu_item_name,
      stock: row.stock_qty ?? 0,
    });
  }

  return {
    categories: Array.from(categoryMap.values()),
    subcategories: Array.from(subcategoryMap.values()),
    baseItems: Array.from(baseItemMap.values()),
    offers,
  };
}

