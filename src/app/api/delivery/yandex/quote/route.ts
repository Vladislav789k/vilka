import { NextRequest, NextResponse } from "next/server";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import { getOrCreateCart } from "@/modules/cart/cartRepository";
import { query } from "@/lib/db";
import { calculateOffers } from "@/lib/yandexDelivery/client";

type QuoteRequest = {
  addressId: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<QuoteRequest>;
    const addressId = Number(body.addressId);
    if (!Number.isFinite(addressId) || addressId <= 0) {
      return NextResponse.json({ error: "addressId обязателен" }, { status: 400 });
    }

    const identity = await resolveCartIdentity();
    if (!identity.userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const cart = await getOrCreateCart(identity);
    if (!cart.items?.length) {
      return NextResponse.json({ error: "Корзина пуста" }, { status: 400 });
    }

    const offerIds = cart.items.map((i) => i.offerId);

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
      return NextResponse.json({ error: "Товары не найдены" }, { status: 400 });
    }

    const restaurantIds = Array.from(new Set(itemRows.map((r) => r.restaurant_id)));
    if (restaurantIds.length !== 1) {
      return NextResponse.json(
        { error: "В корзине товары из разных ресторанов — доставка одним курьером невозможна" },
        { status: 400 }
      );
    }
    const restaurantId = restaurantIds[0]!;

    const qtyByOfferId = new Map<number, number>(cart.items.map((i) => [i.offerId, i.quantity]));
    let totalWeightGrams = 0;
    for (const row of itemRows) {
      const qty = qtyByOfferId.get(row.id) ?? 0;
      const w = row.weight_grams ?? 300; // fallback: 300g per item
      totalWeightGrams += Math.max(0, w) * Math.max(0, qty);
    }
    const totalWeightKg = Math.max(0.2, totalWeightGrams / 1000); // don't go too small

    const { rows: restaurantRows } = await query<{
      id: number;
      address_line: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `
      SELECT id, address_line, city, latitude, longitude
      FROM restaurants
      WHERE id = $1
      LIMIT 1
      `,
      [restaurantId]
    );
    const restaurant = restaurantRows[0];
    if (restaurant?.latitude == null || restaurant?.longitude == null) {
      return NextResponse.json(
        { error: "У ресторана не заданы координаты — нельзя рассчитать доставку" },
        { status: 500 }
      );
    }

    const { rows: addressRows } = await query<{
      id: number;
      address_line: string;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `
      SELECT id, address_line, city, latitude, longitude
      FROM user_addresses
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [addressId, identity.userId]
    );
    const dest = addressRows[0];
    if (!dest) {
      return NextResponse.json({ error: "Адрес не найден" }, { status: 404 });
    }
    if (dest.latitude == null || dest.longitude == null) {
      return NextResponse.json(
        { error: "У адреса не заданы координаты — нельзя рассчитать доставку" },
        { status: 400 }
      );
    }

    const sourceFullname = [restaurant.city, restaurant.address_line].filter(Boolean).join(", ") || "Ресторан";
    const destFullname = dest.address_line;

    const offersRes = await calculateOffers({
      items: [
        {
          quantity: 1,
          weight: totalWeightKg,
          pickup_point: 1,
          dropoff_point: 2,
        },
      ],
      route_points: [
        {
          id: 1,
          coordinates: [restaurant.longitude, restaurant.latitude],
          fullname: sourceFullname,
          country: "Россия",
          city: restaurant.city ?? undefined,
        },
        {
          id: 2,
          coordinates: [dest.longitude, dest.latitude],
          fullname: destFullname,
          country: "Россия",
          city: dest.city ?? undefined,
        },
      ],
      requirements: {
        taxi_classes: ["courier"],
        cargo_options: ["thermobag"],
        pro_courier: false,
        skip_door_to_door: false,
      },
    });

    const courierOffers = (offersRes.offers ?? []).filter((o) => o.taxi_class === "courier");
    if (!courierOffers.length) {
      return NextResponse.json(
        { error: "Нет доступного велокурьера с термосумкой для этого маршрута" },
        { status: 409 }
      );
    }

    // Prefer the cheapest courier offer (bike courier), tie-break by earliest delivery.
    const best = courierOffers
      .map((o) => {
        const effectivePrice = Number(o.price?.total_price_with_vat ?? o.price?.total_price);
        const deliveryTo = new Date(o.delivery_interval?.to).getTime();
        return { o, effectivePrice, deliveryTo };
      })
      .filter((x) => Number.isFinite(x.effectivePrice) && Number.isFinite(x.deliveryTo))
      .sort((a, b) => a.effectivePrice - b.effectivePrice || a.deliveryTo - b.deliveryTo)[0]?.o;

    if (!best) {
      return NextResponse.json({ error: "Не удалось выбрать оффер доставки" }, { status: 500 });
    }

    const etaMinutes = (() => {
      // Prefer explicit ETA from Yandex (minutes) if present.
      if (typeof best.eta === "number" && Number.isFinite(best.eta)) {
        return Math.max(0, Math.round(best.eta));
      }

      // Some responses include tariff_info with total_route_time_seconds.
      const sec = best.tariff_info?.tariff_extra_info?.total_route_time_seconds;
      if (typeof sec === "number" && Number.isFinite(sec) && sec >= 0) {
        return Math.max(0, Math.ceil(sec / 60));
      }

      // Last resort (legacy): approximate from "delivery_interval.to".
      const toTs = new Date(best.delivery_interval?.to).getTime();
      if (!Number.isFinite(toTs)) return null;
      const diffMs = toTs - Date.now();
      if (diffMs <= 0) return 0;
      return Math.ceil(diffMs / 60000);
    })();

    return NextResponse.json({
      taxiClass: best.taxi_class,
      currency: best.price.currency,
      priceRub: Number(best.price.total_price_with_vat ?? best.price.total_price),
      priceWithVatRub: best.price.total_price_with_vat ? Number(best.price.total_price_with_vat) : null,
      payload: best.payload,
      offerTtl: best.offer_ttl,
      pickupInterval: best.pickup_interval,
      deliveryInterval: best.delivery_interval,
      etaMinutes,
    });
  } catch (e) {
    console.error("[POST /api/delivery/yandex/quote] Error:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "server_error",
      },
      { status: 500 }
    );
  }
}

