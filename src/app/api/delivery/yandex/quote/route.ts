import { NextRequest, NextResponse } from "next/server";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import { getDeliveryQuote, loadDeliveryQuoteContext } from "@/lib/yandexDelivery/quote";

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

    const quote = await getDeliveryQuote(await loadDeliveryQuoteContext(identity, addressId));

    return NextResponse.json({
      taxiClass: quote.taxiClass,
      currency: quote.currency,
      priceRub: quote.priceRub,
      priceWithVatRub: quote.priceWithVatRub,
      payload: quote.payload,
      offerTtl: quote.offerTtl,
      pickupInterval: quote.pickupInterval,
      deliveryInterval: quote.deliveryInterval,
      etaMinutes: quote.etaMinutes,
      stale: quote.stale,
    });
  } catch (e) {
    console.error("[POST /api/delivery/yandex/quote] Error:", e);
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
      {
        error: message,
      },
      { status }
    );
  }
}

