import { NextRequest, NextResponse } from "next/server";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import { query } from "@/lib/db";
import { createClaim } from "@/lib/yandexDelivery/client";
import { getDeliveryQuote, loadDeliveryQuoteContext } from "@/lib/yandexDelivery/quote";

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

    const quoteContext = await loadDeliveryQuoteContext(identity, addressId);
    const { cart, restaurant, destination: dest, totalWeightKg, sourceFullname, destFullname } =
      quoteContext;

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

    const requestedOfferPayload =
      typeof body.offerPayload === "string" && body.offerPayload.trim().length > 0
        ? body.offerPayload.trim()
        : null;

    // 1) Select offer payload (prefer payload from /quote to avoid recalculation price drift)
    let offerPayload: string;
    if (requestedOfferPayload) {
      offerPayload = requestedOfferPayload;
    } else {
      offerPayload = (await getDeliveryQuote(quoteContext)).payload;
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
    const message = e instanceof Error ? e.message : "server_error";
    const status =
      /Не авторизован/.test(message)
        ? 401
        : /Корзина пуста|Товары не найдены|В корзине товары из разных ресторанов/.test(message)
        ? 400
        : /Адрес не найден/.test(message)
        ? 404
        : /координаты/.test(message)
        ? 400
        : /Нет доступного велокурьера/.test(message)
        ? 409
        : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

