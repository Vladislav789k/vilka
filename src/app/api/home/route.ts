import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Offer } from "@/modules/catalog/types";

type HomeCollection = {
  id: string;
  title: string;
  items: Offer[];
};

type HomeData = {
  updatedAt: string;
  collections: HomeCollection[];
};

// Cache for 60 seconds
export const revalidate = 60;

export async function GET() {
  try {
    const { rows } = await query<{
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
      tags: string[] | null;
      ref_category_id: number;
      created_at: Date;
    }>(
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
        mi.tags               AS tags,
        mi.ref_category_id    AS ref_category_id,
        mi.created_at         AS created_at
      FROM menu_items mi
      JOIN restaurants r
        ON r.id = mi.restaurant_id
      WHERE mi.is_active = TRUE
        AND mi.stock_qty > 0
      ORDER BY mi.created_at DESC
      `
    );

    const offers: Offer[] = rows.map((row) => {
      const finalPrice =
        row.discount_percent && row.discount_percent > 0
          ? Math.round(row.price * (1 - row.discount_percent / 100))
          : row.price;
      const oldPrice =
        row.discount_percent && row.discount_percent > 0
          ? row.price
          : undefined;

      // Infer isSpicy and isVegetarian from tags or name/description (like getCatalogData does)
      const tags = row.tags || [];
      const nameLower = row.menu_item_name.toLowerCase();
      const compositionLower = (row.composition || "").toLowerCase();
      const isSpicy = 
        tags.some(tag => /остр|spicy|горяч/i.test(tag)) ||
        /остр|spicy|чили|перец/i.test(nameLower) ||
        /остр|spicy|чили|перец/i.test(compositionLower);
      const isVegetarian = 
        tags.some(tag => /вегет|vegetarian|vegan/i.test(tag)) ||
        /вегет|vegetarian|vegan|растительн/i.test(nameLower) ||
        /вегет|vegetarian|vegan|растительн/i.test(compositionLower);

      return {
        id: String(row.menu_item_id),
        baseItemId: String(row.ref_category_id),
        isAnonymous: row.is_brand_anonymous,
        brand: row.is_brand_anonymous ? undefined : row.restaurant_name,
        price: finalPrice,
        oldPrice,
        tag: undefined,
        etaMinutes: undefined,
        imageUrl: row.image_url,
        menuItemName: row.menu_item_name,
        stock: row.stock_qty ?? 0,
        isSpicy,
        isVegetarian,
      };
    });

    // Filter only available items (stock > 0)
    const availableOffers = offers.filter((offer) => offer.stock > 0);

    // Build collections
    const collections: HomeCollection[] = [];

    // Popular now - items with highest stock (most available)
    const popular = [...availableOffers]
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 12);
    if (popular.length > 0) {
      collections.push({
        id: "popular",
        title: "Популярное сейчас",
        items: popular,
      });
    }

    // Discounts - items with discount, sorted by highest discount
    const discounts = availableOffers
      .filter((offer) => offer.oldPrice && offer.oldPrice > offer.price)
      .sort((a, b) => {
        const discountA = ((a.oldPrice! - a.price) / a.oldPrice!) * 100;
        const discountB = ((b.oldPrice! - b.price) / b.oldPrice!) * 100;
        return discountB - discountA;
      })
      .slice(0, 12);
    if (discounts.length > 0) {
      collections.push({
        id: "discounts",
        title: "Скидки",
        items: discounts,
      });
    }

    // Under 300 ₽ - items under 300, sorted by price ascending
    const under300 = availableOffers
      .filter((offer) => offer.price < 300)
      .sort((a, b) => a.price - b.price)
      .slice(0, 12);
    if (under300.length > 0) {
      collections.push({
        id: "under300",
        title: "До 300 ₽",
        items: under300,
      });
    }

    // Spicy 🔥 - spicy items
    const spicy = availableOffers
      .filter((offer) => offer.isSpicy)
      .slice(0, 12);
    if (spicy.length > 0) {
      collections.push({
        id: "spicy",
        title: "Острое 🔥",
        items: spicy,
      });
    }

    // Vegetarian 🌿 - vegetarian items
    const vegetarian = availableOffers
      .filter((offer) => offer.isVegetarian)
      .slice(0, 12);
    if (vegetarian.length > 0) {
      collections.push({
        id: "vegetarian",
        title: "Вегетарианское 🌿",
        items: vegetarian,
      });
    }

    // New today - items created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = availableOffers
      .filter((offer) => {
        const row = rows.find((r) => String(r.menu_item_id) === offer.id);
        if (!row) return false;
        const createdDate = new Date(row.created_at);
        createdDate.setHours(0, 0, 0, 0);
        return createdDate.getTime() === today.getTime();
      })
      .slice(0, 12);
    if (newToday.length > 0) {
      collections.push({
        id: "new-today",
        title: "Новое сегодня",
        items: newToday,
      });
    }

    const data: HomeData = {
      updatedAt: new Date().toISOString(),
      collections,
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/home] error:", err);
    return NextResponse.json(
      { error: "Не удалось загрузить данные" },
      { status: 500 }
    );
  }
}

