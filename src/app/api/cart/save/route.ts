import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import { getOrCreateCart } from "@/modules/cart/cartRepository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body as { name?: string };
    const identity = await resolveCartIdentity();
    const userId = identity.userId;

    if (!userId || !name?.trim()) {
      return NextResponse.json(
        { error: "name и userId обязательны" },
        { status: 400 }
      );
    }

    const cart = await getOrCreateCart(identity);
    if (!cart.items.length) {
      return NextResponse.json({ error: "cart_empty" }, { status: 400 });
    }

    const payload = cart.items.map((item) => ({
      menuItemId: item.offerId,
      quantity: item.quantity,
      comment: item.comment,
      allowReplacement: item.allowReplacement,
    }));

    const insert = await query<{ id: number }>(
      `
      INSERT INTO saved_carts (user_id, name, payload)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [userId, name.trim(), payload]
    );

    return NextResponse.json({ id: insert.rows[0].id });
  } catch (err) {
    console.error("[POST /api/cart/save]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

