import { query, withTransaction } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export type CartIdentity = {
  cartToken: string;
  userId: number | null;
};

export type CartLineInput = {
  offerId: number;
  quantity: number;
  comment?: string;
  allowReplacement?: boolean;
  isFavorite?: boolean;
};

export type CanonicalCartLine = {
  offerId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPrice: number | null;
  comment: string | null;
  allowReplacement: boolean;
  isFavorite: boolean;
};

export type CanonicalCart = {
  cartToken: string;
  deliverySlot: string | null;
  items: CanonicalCartLine[];
  totals: {
    subtotal: number;
    discountTotal: number;
    total: number;
  };
};

export type CartChange = {
  type: "removed" | "price_changed" | "quantity_changed";
  offerId: number;
  message: string;
};

const MIN_ORDER_SUM = 0; // TODO: load from restaurant-specific settings
// Хотим, чтобы корзина реально сохранялась "между заходами".
// Cookie cartToken живёт 30 дней → делаем TTL в Redis тоже длинным.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const cacheKey = (cartToken: string, userId: number | null) => 
  userId ? `cart:user:${userId}` : `cart:${cartToken}`;

type OfferRow = {
  id: number | string; // PostgreSQL bigint может вернуться как строка
  name: string;
  price: number | string; // numeric может вернуться как строка
  discount_percent: number | string | null;
  is_available: boolean;
  is_active: boolean;
  stock_qty: number;
};

async function getOffersMap(offerIds: number[]): Promise<Map<number, OfferRow>> {
  if (offerIds.length === 0) return new Map();
  
  console.log("[getOffersMap] Looking for offer IDs:", offerIds);
  console.log("[getOffersMap] Offer IDs type:", typeof offerIds[0], "Array type:", Array.isArray(offerIds));
  
  // Проверяем запрос напрямую
  try {
    const { rows } = await query<OfferRow>(
      `
      SELECT id, name, price, discount_percent, is_available, is_active, stock_qty
      FROM menu_items
      WHERE id = ANY($1::int[])
      `,
      [offerIds]
    );
    
    console.log("[getOffersMap] Query executed successfully");
    console.log("[getOffersMap] Found", rows.length, "offers in database");
    console.log("[getOffersMap] Found IDs:", rows.map(r => r.id));
    console.log("[getOffersMap] Found rows:", rows.map(r => ({ id: r.id, name: r.name, is_available: r.is_available })));
    
    const map = new Map<number, OfferRow>();
    for (const row of rows) {
      // PostgreSQL bigint возвращается как строка, конвертируем в число
      const rowId = typeof row.id === 'string' ? parseInt(row.id, 10) : row.id;
      map.set(rowId, {
        ...row,
        id: rowId,
        price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
        discount_percent: row.discount_percent 
          ? (typeof row.discount_percent === 'string' ? parseFloat(row.discount_percent) : row.discount_percent)
          : null,
      });
      console.log(`[getOffersMap] Mapped offer ${rowId} (converted from ${row.id}): ${row.name}, available: ${row.is_available}`);
    }
    
    // Проверяем, какие ID не найдены
    const notFound = offerIds.filter(id => !map.has(id));
    if (notFound.length > 0) {
      console.error("[getOffersMap] Offers not found in database:", notFound);
      console.error("[getOffersMap] Requested IDs:", offerIds);
      console.error("[getOffersMap] Found IDs:", Array.from(map.keys()));
      
      // Попробуем найти без фильтра (на всякий)
      const { rows: allRows } = await query<OfferRow>(
        `
        SELECT id, name, price, discount_percent, is_available, is_active, stock_qty
        FROM menu_items
        WHERE id = ANY($1::int[])
        `,
        [notFound]
      );
      console.error("[getOffersMap] Found without is_active filter:", allRows.map(r => ({ 
        id: r.id, 
        name: r.name, 
        is_active: r.is_active, 
        is_available: r.is_available 
      })));
    }
    
    return map;
  } catch (e) {
    console.error("[getOffersMap] Query error:", e);
    throw e;
  }
}

export async function getOrCreateCart(identity: CartIdentity): Promise<CanonicalCart> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not available");
  }

  // Убеждаемся, что Redis подключен
  if (!redis.isOpen) {
    await redis.connect();
  }

  const key = cacheKey(identity.cartToken, identity.userId);
  
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as CanonicalCart;
    }
  } catch (e) {
    console.error("[cart cache] read failed", e);
  }

  // Создаем пустую корзину, если её нет в Redis
  const emptyCart: CanonicalCart = {
    cartToken: identity.cartToken,
    deliverySlot: null,
    items: [],
    totals: {
      subtotal: 0,
      discountTotal: 0,
      total: 0,
    },
  };

  // Сохраняем пустую корзину в Redis
  try {
    await redis.set(key, JSON.stringify(emptyCart), {
      EX: CACHE_TTL_SECONDS,
    });
  } catch (e) {
    console.error("[cart cache] failed to save empty cart", e);
  }

  return emptyCart;
}

export async function validateAndPersistCart(
  identity: CartIdentity,
  input: { deliverySlot?: string | null; items: CartLineInput[] }
): Promise<{
  cart: CanonicalCart;
  changes: CartChange[];
  minOrderSum: number;
  isMinOrderReached: boolean;
  stockByOfferId: Record<number, number>;
}> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not available");
  }

  // Убеждаемся, что Redis подключен
  if (!redis.isOpen) {
    await redis.connect();
  }

  const changes: CartChange[] = [];

  // Берём текущее состояние корзины из Redis, чтобы понять "дельту" и корректно
  // списывать/возвращать остатки в БД.
  const prevCart = await getOrCreateCart(identity);
  const prevQtyByOfferId = new Map<number, number>(
    prevCart.items.map((i) => [i.offerId, i.quantity])
  );

  const desiredQtyByOfferId = new Map<number, number>();
  const inputMetaByOfferId = new Map<number, CartLineInput>();
  for (const line of input.items ?? []) {
    desiredQtyByOfferId.set(line.offerId, line.quantity);
    inputMetaByOfferId.set(line.offerId, line);
  }

  const allOfferIds = Array.from(
    new Set<number>([
      ...Array.from(prevQtyByOfferId.keys()),
      ...Array.from(desiredQtyByOfferId.keys()),
    ])
  );

  const nextQtyByOfferId = new Map<number, number>();
  const offersMap = new Map<number, OfferRow>();
  let stockByOfferId: Record<number, number> = {};

  if (allOfferIds.length > 0) {
    await withTransaction(async (client) => {
      const res = await client.query<OfferRow>(
        `
        SELECT id, name, price, discount_percent, is_available, is_active, stock_qty
        FROM menu_items
        WHERE id = ANY($1::int[])
        FOR UPDATE
        `,
        [allOfferIds]
      );

      for (const row of res.rows) {
        const rowId = typeof row.id === "string" ? parseInt(row.id, 10) : row.id;
        offersMap.set(rowId, {
          ...row,
          id: rowId,
          price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
          discount_percent: row.discount_percent
            ? typeof row.discount_percent === "string"
              ? parseFloat(row.discount_percent)
              : row.discount_percent
            : null,
          stock_qty: Number.isFinite((row as any).stock_qty) ? (row as any).stock_qty : 0,
        });
      }

      for (const offerId of allOfferIds) {
        const offer = offersMap.get(offerId);
        const prevQty = prevQtyByOfferId.get(offerId) ?? 0;
        const desiredQty = desiredQtyByOfferId.get(offerId) ?? 0;

        let nextQty = desiredQty;

        if (!offer) {
          if (desiredQty > 0 || prevQty > 0) {
            changes.push({
              type: "removed",
              offerId,
              message: "Товар не найден в базе данных",
            });
          }
          nextQty = 0;
        } else if (!offer.is_active || !offer.is_available) {
          if (desiredQty > 0 || prevQty > 0) {
            changes.push({
              type: "removed",
              offerId,
              message: "Товар недоступен",
            });
          }
          nextQty = 0;
        } else {
          if (desiredQty <= 0) {
            nextQty = 0;
          } else {
            // stock_qty — это текущий остаток "вне корзин" (мы его уже уменьшаем при добавлении в корзину).
            // Поэтому максимально допустимое количество = то, что уже было в корзине + текущий остаток.
            const maxAllowed = prevQty + Math.max(0, offer.stock_qty ?? 0);
            if (desiredQty > maxAllowed) {
              nextQty = maxAllowed;
              changes.push({
                type: "quantity_changed",
                offerId,
                message:
                  maxAllowed > 0
                    ? `Доступно только ${maxAllowed} шт.`
                    : "Товар закончился",
              });
            }
          }
        }

        // Применяем остатки в БД по дельте (новое - старое)
        const delta = nextQty - prevQty;
        if (offer && delta !== 0) {
          if (delta > 0) {
            // Списываем
            if (offer.stock_qty < delta) {
              // Safety net: не уходим в минус даже при неожиданной рассинхронизации
              nextQty = prevQty + Math.max(0, offer.stock_qty);
            } else {
              await client.query(
                `UPDATE menu_items SET stock_qty = stock_qty - $1 WHERE id = $2`,
                [delta, offerId]
              );
              offer.stock_qty -= delta;
            }
          } else {
            // Возвращаем
            await client.query(
              `UPDATE menu_items SET stock_qty = stock_qty + $1 WHERE id = $2`,
              [-delta, offerId]
            );
            offer.stock_qty += -delta;
          }
        }

        if (nextQty > 0) nextQtyByOfferId.set(offerId, nextQty);
      }

      // фиксируем итоговые остатки после всех списаний/возвратов (для фронта)
      const out: Record<number, number> = {};
      for (const [id, offer] of offersMap.entries()) {
        if (!offer) continue;
        out[id] = Math.max(0, offer.stock_qty ?? 0);
      }
      stockByOfferId = out;
    });
  }

  // Собираем "отфильтрованные" строки для дальнейшей сборки корзины/тоталов
  const filtered: CartLineInput[] = [];
  for (const [offerId, qty] of nextQtyByOfferId.entries()) {
    const offer = offersMap.get(offerId);
    if (!offer) continue;
    const meta = inputMetaByOfferId.get(offerId);
    filtered.push({
      offerId,
      quantity: qty,
      comment: meta?.comment,
      allowReplacement: meta?.allowReplacement,
      isFavorite: meta?.isFavorite,
    });
  }

  // Строим корзину из отфильтрованных товаров
  const items: CanonicalCartLine[] = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const line of filtered) {
    const offer = offersMap.get(line.offerId)!;
    const unitPrice =
      typeof offer.price === "string" ? parseFloat(offer.price) : offer.price;
    const discountPercent =
      offer.discount_percent == null
        ? null
        : typeof offer.discount_percent === "string"
        ? parseFloat(offer.discount_percent)
        : offer.discount_percent;
    const discount =
      discountPercent != null && discountPercent > 0
        ? Math.round(unitPrice * (1 - discountPercent / 100))
        : null;
    const finalPrice = discount ?? unitPrice;
    subtotal += unitPrice * line.quantity;
    discountTotal += (unitPrice - finalPrice) * line.quantity;

    items.push({
      offerId: line.offerId,
      name: offer.name,
      quantity: line.quantity,
      unitPrice,
      discountPrice: discount,
      comment: line.comment ?? null,
      allowReplacement: line.allowReplacement ?? true,
      isFavorite: line.isFavorite ?? false,
    });
  }

  // Создаем корзину
  const cart: CanonicalCart = {
    cartToken: identity.cartToken,
    deliverySlot: input.deliverySlot ?? null,
    items,
    totals: {
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
    },
  };

  // Сохраняем в Redis
  const key = cacheKey(identity.cartToken, identity.userId);
  try {
    console.log("[cart cache] Saving to Redis, key:", key, "userId:", identity.userId);
    console.log("[cart cache] Cart to save:", JSON.stringify(cart, null, 2));
    console.log("[cart cache] Items count:", items.length);
    console.log("[cart cache] Items:", items.map(i => ({ offerId: i.offerId, name: i.name, quantity: i.quantity })));
    
    const cartJson = JSON.stringify(cart);
    console.log("[cart cache] Cart JSON length:", cartJson.length);
    
    await redis.set(key, cartJson, {
      EX: CACHE_TTL_SECONDS,
    });
    
    console.log("[cart cache] Successfully saved to Redis");
    
    // Проверяем, что данные действительно сохранились
    const verify = await redis.get(key);
    if (verify) {
      const parsed = JSON.parse(verify) as CanonicalCart;
      console.log("[cart cache] Verified: data exists in Redis");
      console.log("[cart cache] Verified items count:", parsed.items.length);
      console.log("[cart cache] Verified items:", parsed.items.map(i => ({ offerId: i.offerId, name: i.name, quantity: i.quantity })));
      
      if (parsed.items.length !== items.length) {
        console.error("[cart cache] WARNING: Items count mismatch!", {
          expected: items.length,
          actual: parsed.items.length,
        });
      }
    } else {
      console.error("[cart cache] WARNING: Data was not saved to Redis!");
    }
  } catch (e) {
    console.error("[cart cache] write failed", e);
    console.error("[cart cache] Error details:", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    throw e;
  }

  const isMinOrderReached = cart.totals.total >= MIN_ORDER_SUM;

  return {
    cart,
    changes,
    minOrderSum: MIN_ORDER_SUM,
    isMinOrderReached,
    stockByOfferId,
  };
}

