import { query } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { getOrCreateCart, type CartIdentity, type CanonicalCart } from "@/modules/cart/cartRepository";
import {
  calculateOffers,
  type YandexOfferCalculateRequest,
  type YandexOfferCalculateResponse,
} from "@/lib/yandexDelivery/client";

type RestaurantQuoteRow = {
  id: number;
  name: string;
  address_line: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  settings: unknown | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_full_name: string | null;
};

type AddressQuoteRow = {
  id: number;
  address_line: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type DeliveryQuoteContext = {
  cart: CanonicalCart;
  restaurantId: number;
  restaurant: RestaurantQuoteRow;
  destination: AddressQuoteRow;
  totalWeightKg: number;
  sourceFullname: string;
  destFullname: string;
};

export type DeliveryQuoteResult = {
  taxiClass: "courier" | "express" | "cargo";
  currency: string;
  priceRub: number;
  priceWithVatRub: number | null;
  payload: string;
  offerTtl: string;
  pickupInterval: { from: string; to: string };
  deliveryInterval: { from: string; to: string };
  etaMinutes: number | null;
  stale: boolean;
};

type QuoteCacheEntry = DeliveryQuoteResult & {
  cachedAt: number;
};

const QUOTE_CACHE_TTL_SECONDS = 60;
const QUOTE_STALE_TTL_SECONDS = 300;
const QUOTE_VERSION = "v1";
const QUOTE_REQUIREMENTS = {
  taxi_classes: ["courier"] as const,
  cargo_options: ["thermobag"] as const,
  pro_courier: false,
  skip_door_to_door: false,
};
const inFlightQuotes = new Map<string, Promise<DeliveryQuoteResult>>();

function normalizeWeightBucket(weightKg: number): string {
  return (Math.ceil(weightKg * 10) / 10).toFixed(1);
}

function quoteCacheKey(ctx: DeliveryQuoteContext): string {
  const srcLat = ctx.restaurant.latitude?.toFixed(4) ?? "na";
  const srcLon = ctx.restaurant.longitude?.toFixed(4) ?? "na";
  const dstLat = ctx.destination.latitude?.toFixed(4) ?? "na";
  const dstLon = ctx.destination.longitude?.toFixed(4) ?? "na";

  return [
    "delivery_quote",
    QUOTE_VERSION,
    `restaurant:${ctx.restaurantId}`,
    `address:${ctx.destination.id}`,
    `weight:${normalizeWeightBucket(ctx.totalWeightKg)}`,
    `src:${srcLat},${srcLon}`,
    `dst:${dstLat},${dstLon}`,
  ].join(":");
}

async function getRedisReady() {
  const redis = getRedis();
  if (!redis) return null;

  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (error) {
      if (!redis.isOpen) {
        console.warn("[delivery quote] redis unavailable", error);
        return null;
      }
    }
  }

  return redis;
}

function pickBestCourierOffer(offers: YandexOfferCalculateResponse["offers"]) {
  const courierOffers = (offers ?? []).filter((offer) => offer.taxi_class === "courier");
  if (!courierOffers.length) {
    throw new Error("Нет доступного велокурьера с термосумкой для этого маршрута");
  }

  const best = courierOffers
    .map((offer) => {
      const effectivePrice = Number(offer.price?.total_price_with_vat ?? offer.price?.total_price);
      const deliveryTo = new Date(offer.delivery_interval?.to).getTime();
      return { offer, effectivePrice, deliveryTo };
    })
    .filter((entry) => Number.isFinite(entry.effectivePrice) && Number.isFinite(entry.deliveryTo))
    .sort((left, right) => left.effectivePrice - right.effectivePrice || left.deliveryTo - right.deliveryTo)[0]?.offer;

  if (!best) {
    throw new Error("Не удалось выбрать оффер доставки");
  }

  return best;
}

function resolveEtaMinutes(offer: YandexOfferCalculateResponse["offers"][number]): number | null {
  if (typeof offer.eta === "number" && Number.isFinite(offer.eta)) {
    return Math.max(0, Math.round(offer.eta));
  }

  const seconds = offer.tariff_info?.tariff_extra_info?.total_route_time_seconds;
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(0, Math.ceil(seconds / 60));
  }

  const toTs = new Date(offer.delivery_interval?.to).getTime();
  if (!Number.isFinite(toTs)) return null;
  const diffMs = toTs - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

function toQuoteResult(
  offer: YandexOfferCalculateResponse["offers"][number],
  stale: boolean
): DeliveryQuoteResult {
  return {
    taxiClass: offer.taxi_class,
    currency: offer.price.currency,
    priceRub: Number(offer.price.total_price_with_vat ?? offer.price.total_price),
    priceWithVatRub: offer.price.total_price_with_vat ? Number(offer.price.total_price_with_vat) : null,
    payload: offer.payload,
    offerTtl: offer.offer_ttl,
    pickupInterval: offer.pickup_interval,
    deliveryInterval: offer.delivery_interval,
    etaMinutes: resolveEtaMinutes(offer),
    stale,
  };
}

function buildOfferRequest(ctx: DeliveryQuoteContext): YandexOfferCalculateRequest {
  return {
    items: [
      {
        quantity: 1,
        weight: ctx.totalWeightKg,
        pickup_point: 1,
        dropoff_point: 2,
      },
    ],
    route_points: [
      {
        id: 1,
        coordinates: [ctx.restaurant.longitude!, ctx.restaurant.latitude!],
        fullname: ctx.sourceFullname,
        country: "Россия",
        city: ctx.restaurant.city ?? undefined,
      },
      {
        id: 2,
        coordinates: [ctx.destination.longitude!, ctx.destination.latitude!],
        fullname: ctx.destFullname,
        country: "Россия",
        city: ctx.destination.city ?? undefined,
      },
    ],
    requirements: QUOTE_REQUIREMENTS,
  };
}

function parseQuoteCache(raw: string | null): QuoteCacheEntry | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as QuoteCacheEntry;
    if (!parsed || typeof parsed.payload !== "string") return null;
    if (!Number.isFinite(parsed.cachedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readQuoteCache(key: string): Promise<QuoteCacheEntry | null> {
  const redis = await getRedisReady();
  if (!redis) return null;

  try {
    return parseQuoteCache(await redis.get(key));
  } catch (error) {
    console.warn("[delivery quote] cache read failed", error);
    return null;
  }
}

async function writeQuoteCache(key: string, entry: QuoteCacheEntry) {
  const redis = await getRedisReady();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(entry), { EX: QUOTE_STALE_TTL_SECONDS });
  } catch (error) {
    console.warn("[delivery quote] cache write failed", error);
  }
}

export async function loadDeliveryQuoteContext(
  identity: CartIdentity,
  addressId: number
): Promise<DeliveryQuoteContext> {
  if (!identity.userId) {
    throw new Error("Не авторизован");
  }

  const cart = await getOrCreateCart(identity);
  if (!cart.items.length) {
    throw new Error("Корзина пуста");
  }

  const offerIds = cart.items.map((item) => item.offerId);
  const { rows: itemRows } = await query<{
    id: number;
    restaurant_id: number;
    weight_grams: number | null;
  }>(
    `
    SELECT id, restaurant_id, weight_grams
    FROM menu_items
    WHERE id = ANY($1::bigint[])
    `,
    [offerIds]
  );

  if (!itemRows.length) {
    throw new Error("Товары не найдены");
  }

  const restaurantIds = Array.from(new Set(itemRows.map((row) => row.restaurant_id)));
  if (restaurantIds.length !== 1) {
    throw new Error("В корзине товары из разных ресторанов — доставка одним курьером невозможна");
  }

  const qtyByOfferId = new Map<number, number>(cart.items.map((item) => [item.offerId, item.quantity]));
  let totalWeightGrams = 0;
  for (const row of itemRows) {
    const qty = qtyByOfferId.get(row.id) ?? 0;
    const weight = row.weight_grams ?? 300;
    totalWeightGrams += Math.max(0, weight) * Math.max(0, qty);
  }
  const totalWeightKg = Math.max(0.2, totalWeightGrams / 1000);

  const restaurantId = restaurantIds[0]!;
  const { rows: restaurantRows } = await query<RestaurantQuoteRow>(
    `
    SELECT
      r.id,
      r.name,
      r.address_line,
      r.city,
      r.latitude,
      r.longitude,
      r.settings,
      u.phone AS owner_phone,
      u.email AS owner_email,
      p.full_name AS owner_full_name
    FROM restaurants r
    LEFT JOIN users u ON u.id = r.owner_user_id
    LEFT JOIN user_profiles p ON p.user_id = r.owner_user_id
    WHERE r.id = $1
    LIMIT 1
    `,
    [restaurantId]
  );
  const restaurant = restaurantRows[0];
  if (!restaurant || restaurant.latitude == null || restaurant.longitude == null) {
    throw new Error("У ресторана не заданы координаты — нельзя рассчитать доставку");
  }

  const { rows: addressRows } = await query<AddressQuoteRow>(
    `
    SELECT id, address_line, city, latitude, longitude
    FROM user_addresses
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [addressId, identity.userId]
  );
  const destination = addressRows[0];
  if (!destination) {
    throw new Error("Адрес не найден");
  }
  if (destination.latitude == null || destination.longitude == null) {
    throw new Error("У адреса не заданы координаты — нельзя рассчитать доставку");
  }

  return {
    cart,
    restaurantId,
    restaurant,
    destination,
    totalWeightKg,
    sourceFullname: [restaurant.city, restaurant.address_line].filter(Boolean).join(", ") || "Ресторан",
    destFullname: destination.address_line,
  };
}

export async function getDeliveryQuote(ctx: DeliveryQuoteContext): Promise<DeliveryQuoteResult> {
  const key = quoteCacheKey(ctx);
  const now = Date.now();
  const cached = await readQuoteCache(key);
  if (cached && now - cached.cachedAt <= QUOTE_CACHE_TTL_SECONDS * 1000) {
    return { ...cached, stale: false };
  }

  const inflight = inFlightQuotes.get(key);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const staleCandidate =
      cached && now - cached.cachedAt <= QUOTE_STALE_TTL_SECONDS * 1000 ? cached : null;

    try {
      const offersRes = await calculateOffers(buildOfferRequest(ctx));
      const best = pickBestCourierOffer(offersRes.offers ?? []);
      const result = toQuoteResult(best, false);
      await writeQuoteCache(key, { ...result, cachedAt: Date.now() });
      return result;
    } catch (error) {
      if (staleCandidate) {
        return { ...staleCandidate, stale: true };
      }
      throw error;
    } finally {
      inFlightQuotes.delete(key);
    }
  })();

  inFlightQuotes.set(key, promise);
  return promise;
}
