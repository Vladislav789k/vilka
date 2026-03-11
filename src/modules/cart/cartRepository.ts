import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
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

type ActiveCartRow = {
  id: number | string;
  user_id: number | string | null;
  cart_token: string | null;
  delivery_slot: string | null;
  restaurant_id: number | string | null;
};

type PersistedCartItemRow = {
  menu_item_id: number | string;
  quantity: number | string;
  item_name: string;
  unit_price: number | string;
  comment: string | null;
  allow_replacement: boolean | null;
  favorite: boolean | null;
};

type HydratedCartItemRow = PersistedCartItemRow & {
  current_name: string | null;
  current_price: number | string | null;
  discount_percent: number | string | null;
};

type OfferRow = {
  id: number | string;
  name: string;
  price: number | string;
  discount_percent: number | string | null;
  is_available: boolean;
  is_active: boolean;
  stock_qty: number | string;
  restaurant_id: number | string | null;
};

type PersistedCartItem = {
  offerId: number;
  quantity: number;
  itemName: string;
  unitPrice: number;
  comment: string | null;
  allowReplacement: boolean;
  isFavorite: boolean;
};

const MIN_ORDER_SUM = 0;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const cacheKey = (cartToken: string, userId: number | null) =>
  userId ? `cart:user:${userId}` : `cart:${cartToken}`;

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

async function getRedisReady() {
  const redis = getRedis();
  if (!redis) return null;

  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (error) {
      if (!redis.isOpen) {
        console.warn("[cart cache] redis unavailable", error);
        return null;
      }
    }
  }

  return redis;
}

async function publishCartUpdate(opts: {
  key: string;
  cart: CanonicalCart;
  changes?: CartChange[];
  stockByOfferId?: Record<number, number>;
}) {
  const redis = await getRedisReady();
  if (!redis) return;

  try {
    await redis.publish(
      "cart_updates",
      JSON.stringify({
        key: opts.key,
        cart: opts.cart,
        changes: opts.changes ?? [],
        stockByOfferId: opts.stockByOfferId ?? {},
        ts: Date.now(),
      })
    );
  } catch (error) {
    console.warn("[cart realtime] publish failed", error);
  }
}

async function mirrorCartToCache(identity: CartIdentity, cart: CanonicalCart) {
  const redis = await getRedisReady();
  if (!redis) return;

  try {
    await redis.set(cacheKey(identity.cartToken, identity.userId), JSON.stringify(cart), {
      EX: CACHE_TTL_SECONDS,
    });

    if (identity.userId) {
      await redis.del(cacheKey(identity.cartToken, null)).catch(() => undefined);
    }
  } catch (error) {
    console.warn("[cart cache] mirror failed", error);
  }
}

function parseCanonicalCart(raw: string | null): CanonicalCart | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CanonicalCart;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeCanonicalCarts(cartToken: string, carts: Array<CanonicalCart | null>): CanonicalCart | null {
  const valid = carts.filter((cart): cart is CanonicalCart => Boolean(cart));
  if (valid.length === 0) return null;

  const merged = new Map<number, CanonicalCartLine>();
  let deliverySlot: string | null = null;

  for (const cart of valid) {
    if (!deliverySlot && cart.deliverySlot) {
      deliverySlot = cart.deliverySlot;
    }

    for (const item of cart.items) {
      const existing = merged.get(item.offerId);
      if (existing) {
        merged.set(item.offerId, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          comment: existing.comment ?? item.comment ?? null,
          allowReplacement: existing.allowReplacement && item.allowReplacement,
          isFavorite: existing.isFavorite || item.isFavorite,
        });
        continue;
      }

      merged.set(item.offerId, { ...item });
    }
  }

  const items = Array.from(merged.values());
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const finalPrice = item.discountPrice ?? item.unitPrice;
    subtotal += item.unitPrice * item.quantity;
    discountTotal += (item.unitPrice - finalPrice) * item.quantity;
  }

  return {
    cartToken,
    deliverySlot,
    items,
    totals: {
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
    },
  };
}

async function readLegacyCartFromCache(identity: CartIdentity): Promise<CanonicalCart | null> {
  const redis = await getRedisReady();
  if (!redis) return null;

  try {
    const raws = await Promise.all([
      identity.userId ? redis.get(cacheKey(identity.cartToken, identity.userId)) : Promise.resolve(null),
      redis.get(cacheKey(identity.cartToken, null)),
    ]);

    return mergeCanonicalCarts(
      identity.cartToken,
      raws.map((raw) => parseCanonicalCart(raw))
    );
  } catch (error) {
    console.warn("[cart cache] legacy read failed", error);
    return null;
  }
}

async function getActiveCartByUser(client: PoolClient, userId: number): Promise<ActiveCartRow | null> {
  const { rows } = await client.query<ActiveCartRow>(
    `
    SELECT id, user_id, cart_token, delivery_slot, restaurant_id
    FROM carts
    WHERE user_id = $1 AND status = 'active'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

async function getActiveCartByToken(client: PoolClient, cartToken: string): Promise<ActiveCartRow | null> {
  const { rows } = await client.query<ActiveCartRow>(
    `
    SELECT id, user_id, cart_token, delivery_slot, restaurant_id
    FROM carts
    WHERE cart_token = $1 AND status = 'active'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
    `,
    [cartToken]
  );

  return rows[0] ?? null;
}

async function createActiveCart(
  client: PoolClient,
  identity: CartIdentity,
  restaurantId: number | null,
  deliverySlot: string | null = null
): Promise<ActiveCartRow> {
  const { rows } = await client.query<ActiveCartRow>(
    `
    INSERT INTO carts (user_id, cart_token, restaurant_id, delivery_slot, status)
    VALUES ($1, $2, $3, $4, 'active')
    RETURNING id, user_id, cart_token, delivery_slot, restaurant_id
    `,
    [identity.userId, identity.cartToken, restaurantId, deliverySlot]
  );

  return rows[0]!;
}

async function updateCartOwnership(
  client: PoolClient,
  cartId: number,
  identity: CartIdentity
): Promise<ActiveCartRow> {
  const { rows } = await client.query<ActiveCartRow>(
    `
    UPDATE carts
    SET user_id = $1,
        cart_token = $2,
        updated_at = now()
    WHERE id = $3
    RETURNING id, user_id, cart_token, delivery_slot, restaurant_id
    `,
    [identity.userId, identity.cartToken, cartId]
  );

  return rows[0]!;
}

async function getPersistedCartItems(
  client: PoolClient,
  cartId: number,
  opts?: { forUpdate?: boolean }
): Promise<PersistedCartItemRow[]> {
  const suffix = opts?.forUpdate ? " FOR UPDATE" : "";
  const { rows } = await client.query<PersistedCartItemRow>(
    `
    SELECT menu_item_id, quantity, item_name, unit_price, comment, allow_replacement, favorite
    FROM cart_items
    WHERE cart_id = $1
    ORDER BY id ASC
    ${suffix}
    `,
    [cartId]
  );

  return rows;
}

async function replaceCartItems(client: PoolClient, cartId: number, items: PersistedCartItem[]) {
  await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);

  for (const item of items) {
    await client.query(
      `
      INSERT INTO cart_items (
        cart_id,
        menu_item_id,
        quantity,
        item_name,
        unit_price,
        options,
        comment,
        allow_replacement,
        favorite
      )
      VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)
      `,
      [
        cartId,
        item.offerId,
        item.quantity,
        item.itemName,
        item.unitPrice,
        item.comment,
        item.allowReplacement,
        item.isFavorite,
      ]
    );
  }
}

async function mergeCartRecords(
  client: PoolClient,
  identity: CartIdentity,
  targetCart: ActiveCartRow,
  sourceCart: ActiveCartRow
): Promise<ActiveCartRow> {
  if (Number(targetCart.id) === Number(sourceCart.id)) {
    return updateCartOwnership(client, Number(targetCart.id), identity);
  }

  const targetItems = await getPersistedCartItems(client, Number(targetCart.id), { forUpdate: true });
  const sourceItems = await getPersistedCartItems(client, Number(sourceCart.id), { forUpdate: true });

  const merged = new Map<number, PersistedCartItem>();

  for (const row of [...targetItems, ...sourceItems]) {
    const offerId = asNumber(row.menu_item_id);
    const quantity = asNumber(row.quantity);
    if (!Number.isFinite(offerId) || !Number.isFinite(quantity) || quantity <= 0) continue;

    const existing = merged.get(offerId);
    const item: PersistedCartItem = {
      offerId,
      quantity,
      itemName: row.item_name,
      unitPrice: asNumber(row.unit_price),
      comment: row.comment ?? null,
      allowReplacement: row.allow_replacement ?? true,
      isFavorite: row.favorite ?? false,
    };

    if (!existing) {
      merged.set(offerId, item);
      continue;
    }

    merged.set(offerId, {
      offerId,
      quantity: existing.quantity + item.quantity,
      itemName: existing.itemName || item.itemName,
      unitPrice: Number.isFinite(existing.unitPrice) ? existing.unitPrice : item.unitPrice,
      comment: existing.comment ?? item.comment,
      allowReplacement: existing.allowReplacement && item.allowReplacement,
      isFavorite: existing.isFavorite || item.isFavorite,
    });
  }

  await replaceCartItems(client, Number(targetCart.id), Array.from(merged.values()));
  await client.query(
    `
    UPDATE carts
    SET user_id = $1,
        cart_token = $2,
        delivery_slot = COALESCE(carts.delivery_slot, $3),
        updated_at = now()
    WHERE id = $4
    `,
    [identity.userId, identity.cartToken, sourceCart.delivery_slot, targetCart.id]
  );
  await client.query(`DELETE FROM carts WHERE id = $1`, [sourceCart.id]);

  const { rows } = await client.query<ActiveCartRow>(
    `
    SELECT id, user_id, cart_token, delivery_slot, restaurant_id
    FROM carts
    WHERE id = $1
    LIMIT 1
    `,
    [targetCart.id]
  );

  return rows[0]!;
}

async function hydrateCart(client: PoolClient, cartRow: ActiveCartRow, cartToken: string): Promise<CanonicalCart> {
  const { rows } = await client.query<HydratedCartItemRow>(
    `
    SELECT
      ci.menu_item_id,
      ci.quantity,
      ci.item_name,
      ci.unit_price,
      ci.comment,
      ci.allow_replacement,
      ci.favorite,
      mi.name AS current_name,
      mi.price AS current_price,
      mi.discount_percent
    FROM cart_items ci
    LEFT JOIN menu_items mi ON mi.id = ci.menu_item_id
    WHERE ci.cart_id = $1
    ORDER BY ci.id ASC
    `,
    [cartRow.id]
  );

  const items: CanonicalCartLine[] = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const row of rows) {
    const offerId = asNumber(row.menu_item_id);
    const quantity = asNumber(row.quantity);
    if (!Number.isFinite(offerId) || !Number.isFinite(quantity) || quantity <= 0) continue;

    const unitPriceRaw = row.current_price ?? row.unit_price;
    const unitPrice = asNumber(unitPriceRaw);
    if (!Number.isFinite(unitPrice)) continue;

    const discountPercent = row.discount_percent == null ? null : asNumber(row.discount_percent);
    const discountPrice =
      discountPercent != null && Number.isFinite(discountPercent) && discountPercent > 0
        ? Math.round(unitPrice * (1 - discountPercent / 100))
        : null;
    const finalPrice = discountPrice ?? unitPrice;

    subtotal += unitPrice * quantity;
    discountTotal += (unitPrice - finalPrice) * quantity;

    items.push({
      offerId,
      name: row.current_name ?? row.item_name,
      quantity,
      unitPrice,
      discountPrice,
      comment: row.comment ?? null,
      allowReplacement: row.allow_replacement ?? true,
      isFavorite: row.favorite ?? false,
    });
  }

  return {
    cartToken,
    deliverySlot: cartRow.delivery_slot ?? null,
    items,
    totals: {
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
    },
  };
}

async function seedCartFromLegacyCache(
  client: PoolClient,
  identity: CartIdentity
): Promise<ActiveCartRow | null> {
  const legacyCart = await readLegacyCartFromCache(identity);
  if (!legacyCart || legacyCart.items.length === 0) {
    return null;
  }

  const offerIds = legacyCart.items.map((item) => item.offerId);
  let restaurantId: number | null = null;
  if (offerIds.length > 0) {
    const { rows } = await client.query<{ restaurant_id: number | string | null }>(
      `
      SELECT restaurant_id
      FROM menu_items
      WHERE id = ANY($1::int[])
      ORDER BY id ASC
      LIMIT 1
      `,
      [offerIds]
    );
    const rawRestaurantId = rows[0]?.restaurant_id;
    const parsedRestaurantId = rawRestaurantId == null ? Number.NaN : asNumber(rawRestaurantId);
    restaurantId = Number.isFinite(parsedRestaurantId) ? parsedRestaurantId : null;
  }

  const cartRow = await createActiveCart(client, identity, restaurantId, legacyCart.deliverySlot ?? null);
  const items: PersistedCartItem[] = legacyCart.items.map((item) => ({
    offerId: item.offerId,
    quantity: item.quantity,
    itemName: item.name,
    unitPrice: item.unitPrice,
    comment: item.comment ?? null,
    allowReplacement: item.allowReplacement,
    isFavorite: item.isFavorite,
  }));
  await replaceCartItems(client, Number(cartRow.id), items);

  return cartRow;
}

async function ensureActiveCartRecord(
  client: PoolClient,
  identity: CartIdentity,
  opts?: { createIfMissing?: boolean; restaurantId?: number | null; deliverySlot?: string | null }
): Promise<ActiveCartRow | null> {
  const createIfMissing = opts?.createIfMissing ?? true;
  const tokenCart = await getActiveCartByToken(client, identity.cartToken);

  if (!identity.userId) {
    if (tokenCart) return tokenCart;

    const seededGuestCart = await seedCartFromLegacyCache(client, identity);
    if (seededGuestCart) return seededGuestCart;

    if (!createIfMissing) return null;
    return createActiveCart(client, identity, opts?.restaurantId ?? null, opts?.deliverySlot ?? null);
  }

  const userCart = await getActiveCartByUser(client, identity.userId);

  if (userCart && tokenCart && Number(userCart.id) !== Number(tokenCart.id)) {
    return mergeCartRecords(client, identity, userCart, tokenCart);
  }

  if (userCart) {
    return updateCartOwnership(client, Number(userCart.id), identity);
  }

  if (tokenCart) {
    return updateCartOwnership(client, Number(tokenCart.id), identity);
  }

  const seededUserCart = await seedCartFromLegacyCache(client, identity);
  if (seededUserCart) return seededUserCart;

  if (!createIfMissing) return null;
  return createActiveCart(client, identity, opts?.restaurantId ?? null, opts?.deliverySlot ?? null);
}

function buildStockMessage(maxAllowed: number): string {
  return maxAllowed > 0 ? `Доступно только ${maxAllowed} шт.` : "Товар закончился";
}

export async function getOrCreateCart(identity: CartIdentity): Promise<CanonicalCart> {
  const cart = await withTransaction(async (client) => {
    const cartRow = await ensureActiveCartRecord(client, identity, { createIfMissing: false });
    if (!cartRow) {
      return {
        cartToken: identity.cartToken,
        deliverySlot: null,
        items: [],
        totals: { subtotal: 0, discountTotal: 0, total: 0 },
      };
    }
    return hydrateCart(client, cartRow, identity.cartToken);
  });

  await mirrorCartToCache(identity, cart);
  return cart;
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
  const changes: CartChange[] = [];
  const stockByOfferId: Record<number, number> = {};

  const cart = await withTransaction(async (client) => {
    let cartRow = await ensureActiveCartRecord(client, identity, { createIfMissing: false });
    const prevItems = cartRow
      ? await getPersistedCartItems(client, Number(cartRow.id), { forUpdate: true })
      : [];
    const prevQtyByOfferId = new Map<number, number>();

    for (const row of prevItems) {
      const offerId = asNumber(row.menu_item_id);
      const quantity = asNumber(row.quantity);
      if (!Number.isFinite(offerId) || !Number.isFinite(quantity) || quantity <= 0) continue;
      prevQtyByOfferId.set(offerId, quantity);
    }

    const desiredQtyByOfferId = new Map<number, number>();
    const inputMetaByOfferId = new Map<number, CartLineInput>();
    for (const line of input.items ?? []) {
      const offerId = Number(line.offerId);
      const quantity = Math.max(0, Number(line.quantity));
      if (!Number.isFinite(offerId)) continue;
      desiredQtyByOfferId.set(offerId, quantity);
      inputMetaByOfferId.set(offerId, {
        offerId,
        quantity,
        comment: line.comment,
        allowReplacement: line.allowReplacement,
        isFavorite: line.isFavorite,
      });
    }

    const allOfferIds = Array.from(
      new Set<number>([
        ...Array.from(prevQtyByOfferId.keys()),
        ...Array.from(desiredQtyByOfferId.keys()),
      ])
    );

    const nextQtyByOfferId = new Map<number, number>();
    const offersMap = new Map<number, OfferRow>();

    if (allOfferIds.length > 0) {
      const { rows } = await client.query<OfferRow>(
        `
        SELECT id, name, price, discount_percent, is_available, is_active, stock_qty, restaurant_id
        FROM menu_items
        WHERE id = ANY($1::int[])
        FOR UPDATE
        `,
        [allOfferIds]
      );

      for (const row of rows) {
        const offerId = asNumber(row.id);
        if (!Number.isFinite(offerId)) continue;
        offersMap.set(offerId, row);
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
        } else if (desiredQty > 0) {
          const stockQty = Math.max(0, asNumber(offer.stock_qty));
          const maxAllowed = prevQty + stockQty;
          if (desiredQty > maxAllowed) {
            nextQty = maxAllowed;
            changes.push({
              type: "quantity_changed",
              offerId,
              message: buildStockMessage(maxAllowed),
            });
          }
        }

        const delta = nextQty - prevQty;
        if (offer && delta !== 0) {
          const stockQty = Math.max(0, asNumber(offer.stock_qty));

          if (delta > 0 && stockQty < delta) {
            const maxAllowed = prevQty + stockQty;
            nextQty = maxAllowed;

            if (!changes.some((change) => change.type === "quantity_changed" && change.offerId === offerId)) {
              changes.push({
                type: "quantity_changed",
                offerId,
                message: buildStockMessage(maxAllowed),
              });
            }
          }

          const safeDelta = nextQty - prevQty;
          if (safeDelta > 0) {
            await client.query(`UPDATE menu_items SET stock_qty = stock_qty - $1 WHERE id = $2`, [
              safeDelta,
              offerId,
            ]);
            offer.stock_qty = Math.max(0, stockQty - safeDelta);
          } else if (safeDelta < 0) {
            await client.query(`UPDATE menu_items SET stock_qty = stock_qty + $1 WHERE id = $2`, [
              -safeDelta,
              offerId,
            ]);
            offer.stock_qty = stockQty + -safeDelta;
          }
        }

        if (nextQty > 0) {
          nextQtyByOfferId.set(offerId, nextQty);
        }
      }

      for (const [offerId, offer] of offersMap.entries()) {
        stockByOfferId[offerId] = Math.max(0, asNumber(offer.stock_qty));
      }
    }

    const canonicalItems: CanonicalCartLine[] = [];
    const persistedItems: PersistedCartItem[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    const restaurantIds = new Set<number>();

    for (const [offerId, quantity] of nextQtyByOfferId.entries()) {
      const offer = offersMap.get(offerId);
      if (!offer) continue;

      const unitPrice = asNumber(offer.price);
      if (!Number.isFinite(unitPrice)) continue;

      const discountPercent = offer.discount_percent == null ? null : asNumber(offer.discount_percent);
      const discountPrice =
        discountPercent != null && Number.isFinite(discountPercent) && discountPercent > 0
          ? Math.round(unitPrice * (1 - discountPercent / 100))
          : null;
      const finalPrice = discountPrice ?? unitPrice;
      const meta = inputMetaByOfferId.get(offerId);

      subtotal += unitPrice * quantity;
      discountTotal += (unitPrice - finalPrice) * quantity;

      canonicalItems.push({
        offerId,
        name: offer.name,
        quantity,
        unitPrice,
        discountPrice,
        comment: meta?.comment ?? null,
        allowReplacement: meta?.allowReplacement ?? true,
        isFavorite: meta?.isFavorite ?? false,
      });

      persistedItems.push({
        offerId,
        quantity,
        itemName: offer.name,
        unitPrice,
        comment: meta?.comment ?? null,
        allowReplacement: meta?.allowReplacement ?? true,
        isFavorite: meta?.isFavorite ?? false,
      });

      const restaurantId = asNumber(offer.restaurant_id);
      if (Number.isFinite(restaurantId)) {
        restaurantIds.add(restaurantId);
      }
    }

    const nextDeliverySlot = input.deliverySlot ?? cartRow?.delivery_slot ?? null;
    const restaurantId = restaurantIds.size > 0 ? Array.from(restaurantIds)[0]! : null;

    if (!cartRow && persistedItems.length === 0) {
      return {
        cartToken: identity.cartToken,
        deliverySlot: nextDeliverySlot,
        items: canonicalItems,
        totals: {
          subtotal,
          discountTotal,
          total: subtotal - discountTotal,
        },
      };
    }

    if (!cartRow) {
      cartRow = await createActiveCart(client, identity, restaurantId, nextDeliverySlot);
    }

    await replaceCartItems(client, Number(cartRow.id), persistedItems);
    await client.query(
      `
      UPDATE carts
      SET user_id = $1,
          cart_token = $2,
          delivery_slot = $3,
          restaurant_id = $4,
          updated_at = now()
      WHERE id = $5
      `,
      [identity.userId, identity.cartToken, nextDeliverySlot, restaurantId, cartRow.id]
    );

    return {
      cartToken: identity.cartToken,
      deliverySlot: nextDeliverySlot,
      items: canonicalItems,
      totals: {
        subtotal,
        discountTotal,
        total: subtotal - discountTotal,
      },
    };
  });

  await mirrorCartToCache(identity, cart);
  await publishCartUpdate({
    key: cacheKey(identity.cartToken, identity.userId),
    cart,
    changes,
    stockByOfferId,
  });

  const isMinOrderReached = cart.totals.total >= MIN_ORDER_SUM;

  return {
    cart,
    changes,
    minOrderSum: MIN_ORDER_SUM,
    isMinOrderReached,
    stockByOfferId,
  };
}

