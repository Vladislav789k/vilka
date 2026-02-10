import { NextRequest, NextResponse } from "next/server";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import { getOrCreateCart } from "@/modules/cart/cartRepository";
import { query } from "@/lib/db";
import { calculateOffers, createClaim } from "@/lib/yandexDelivery/client";

type ClaimRequest = {
  addressId: number;
  offerPayload?: string;
  recipient?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  leaveAtDoor?: boolean;
  entrance?: string;
  floor?: string;
  apartment?: string;
  intercom?: string;
  comment?: string;
};

function normPhone(phone: string): string {
  // API принимает довольно свободный формат, но попробуем убрать лишние пробелы.
  return phone.replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ClaimRequest>;
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
      name: string;
      restaurant_id: number;
      weight_grams: number | null;
    }>(
      `
      SELECT id, name, restaurant_id, weight_grams
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
      const w = row.weight_grams ?? 300;
      totalWeightGrams += Math.max(0, w) * Math.max(0, qty);
    }
    const totalWeightKg = Math.max(0.2, totalWeightGrams / 1000);

    const { rows: restaurantRows } = await query<{
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
    }>(
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
    if (restaurant?.latitude == null || restaurant?.longitude == null) {
      return NextResponse.json(
        { error: "У ресторана не заданы координаты — нельзя создать доставку" },
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
        { error: "У адреса не заданы координаты — нельзя создать доставку" },
        { status: 400 }
      );
    }

    // Recipient fallback from DB
    let recipientName = body.recipient?.name?.trim() || "";
    let recipientPhone = body.recipient?.phone?.trim() || "";
    let recipientEmail = body.recipient?.email?.trim() || "";

    if (!recipientName || !recipientPhone) {
      const { rows: userRows } = await query<{
        phone: string;
        email: string | null;
        full_name: string | null;
      }>(
        `
        SELECT u.phone, u.email, p.full_name
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
        `,
        [identity.userId]
      );
      const u = userRows[0];
      if (!recipientPhone && u?.phone) recipientPhone = u.phone;
      if (!recipientEmail && u?.email) recipientEmail = u.email;
      if (!recipientName && u?.full_name) recipientName = u.full_name;
    }

    if (!recipientName) recipientName = "Получатель";
    if (!recipientPhone) {
      return NextResponse.json(
        { error: "Нужно указать телефон получателя (или заполнить телефон у пользователя)" },
        { status: 400 }
      );
    }

    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v != null && !Array.isArray(v);
    const settings = isRecord(restaurant?.settings) ? restaurant.settings : null;
    const settingsContactName =
      settings && typeof settings.contact_name === "string" ? settings.contact_name : null;
    const settingsContactPhone =
      settings && typeof settings.contact_phone === "string" ? settings.contact_phone : null;
    const settingsContactEmail =
      settings && typeof settings.contact_email === "string" ? settings.contact_email : null;

    const sourceContactName =
      (settingsContactName?.trim() ||
        restaurant?.owner_full_name?.trim() ||
        restaurant?.name?.trim() ||
        "Ресторан") as string;
    const sourceContactPhone =
      (settingsContactPhone?.trim() || restaurant?.owner_phone?.trim() || "") as string;
    const sourceContactEmail =
      (settingsContactEmail?.trim() || restaurant?.owner_email?.trim() || "") as string;

    if (!sourceContactPhone) {
      return NextResponse.json(
        { error: "У ресторана не задан телефон контакта (users.phone или restaurants.settings.contact_phone)" },
        { status: 500 }
      );
    }
    if (!sourceContactEmail) {
      return NextResponse.json(
        { error: "У ресторана не задан email контакта (restaurants.settings.contact_email или users.email)" },
        { status: 500 }
      );
    }

    const sourceFullname = [restaurant.city, restaurant.address_line].filter(Boolean).join(", ") || "Ресторан";
    const destFullname = dest.address_line;

    const requestedOfferPayload =
      typeof body.offerPayload === "string" && body.offerPayload.trim().length > 0
        ? body.offerPayload.trim()
        : null;

    // 1) Select offer payload (prefer payload from /quote to avoid recalculation price drift)
    let offerPayload: string;
    if (requestedOfferPayload) {
      offerPayload = requestedOfferPayload;
    } else {
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

      offerPayload = best.payload;
    }

    const leaveAtDoor = Boolean(body.leaveAtDoor);

    const doorCommentParts = [
      body.comment?.trim(),
      body.entrance ? `Подъезд: ${body.entrance}` : null,
      body.floor ? `Этаж: ${body.floor}` : null,
      body.apartment ? `Кв/офис: ${body.apartment}` : null,
      body.intercom ? `Домофон: ${body.intercom}` : null,
    ].filter(Boolean) as string[];

    const destComment = doorCommentParts.join(". ");

    // 2) Create claim
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    let claimRes: Awaited<ReturnType<typeof createClaim>>;
    try {
      claimRes = await createClaim({
        requestId,
        body: {
          // Use Eats couriers supply (if enabled for the account/contract).
          claim_kind: "platform_usage",
          offer_payload: offerPayload,
          comment: restaurant.name,
          items: [
            {
              extra_id: identity.cartToken,
              pickup_point: 1,
              dropoff_point: 2,
              title: `Заказ ${identity.cartToken}`,
              quantity: 1,
              weight: totalWeightKg,
              cost_value: Number.isFinite(cart.totals.total) ? cart.totals.total.toFixed(2) : "0.00",
              cost_currency: "RUB",
              age_restricted: false,
            },
          ],
          route_points: [
            {
              point_id: 1,
              visit_order: 1,
              type: "source",
              contact: {
                name: sourceContactName,
                phone: normPhone(sourceContactPhone),
                email: sourceContactEmail,
              },
              address: {
                fullname: sourceFullname,
                coordinates: [restaurant.longitude, restaurant.latitude],
                city: restaurant.city ?? undefined,
                country: "Россия",
                comment:
                  `Доставка из ${restaurant.name}. Сообщите менеджеру, что заказ для Яндекс Доставки. ` +
                  `Назовите номер заказа ${identity.cartToken} и заберите посылку.`,
              },
            },
            {
              point_id: 2,
              visit_order: 2,
              type: "destination",
              contact: {
                name: recipientName,
                phone: normPhone(recipientPhone),
                email: recipientEmail || undefined,
              },
              address: {
                fullname: destFullname,
                coordinates: [dest.longitude, dest.latitude],
                city: dest.city ?? undefined,
                country: "Россия",
                comment: destComment || undefined,
                porch: body.entrance?.trim() || undefined,
                sfloor: body.floor?.trim() || undefined,
                sflat: body.apartment?.trim() || undefined,
                door_code: body.intercom?.trim() || undefined,
              },
              external_order_id: identity.cartToken,
              leave_under_door: leaveAtDoor,
            },
          ],
          client_requirements: {
            taxi_class: "courier",
            cargo_options: ["thermobag"],
            pro_courier: false,
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";

      // If account/contract doesn't support Eats supply, surface a clear error.
      if (/claim_kind|platform_usage/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Ваш договор/аккаунт Яндекс Доставки не поддерживает claim_kind=platform_usage (курьеры еды). " +
              "Нужна настройка со стороны Яндекса или используйте delivery_service.",
          },
          { status: 400 }
        );
      }

      // If we used payload from /quote, fail loudly on expiry instead of silently recalculating to a potentially more expensive offer.
      if (requestedOfferPayload) {
        const seemsExpired =
          /offer|payload|ttl|expired|время|истек/i.test(msg) ||
          /offer_payload/i.test(msg);
        if (seemsExpired) {
          return NextResponse.json(
            { error: "Оффер доставки устарел (цена могла измениться). Пересчитайте доставку и попробуйте снова." },
            { status: 409 }
          );
        }
      }
      throw e;
    }

    return NextResponse.json({
      id: claimRes.id,
      status: claimRes.status,
      version: claimRes.version,
      etaMinutes: typeof claimRes.eta === "number" && Number.isFinite(claimRes.eta) ? claimRes.eta : null,
      requestId,
    });
  } catch (e) {
    console.error("[POST /api/delivery/yandex/claim] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 500 }
    );
  }
}

