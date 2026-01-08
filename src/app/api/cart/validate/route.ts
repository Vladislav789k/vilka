import { NextRequest, NextResponse } from "next/server";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";
import {
  validateAndPersistCart,
  type CartLineInput,
} from "@/modules/cart/cartRepository";

type ValidateCartRequest = {
  deliverySlot?: string | null;
  items: CartLineInput[];
};

export async function POST(req: NextRequest) {
  try {
    console.log("[POST /api/cart/validate] Request received");
    const body = (await req.json()) as ValidateCartRequest;
    console.log("[POST /api/cart/validate] Body:", JSON.stringify(body, null, 2));
    
    const identity = await resolveCartIdentity();
    console.log("[POST /api/cart/validate] Identity:", {
      cartToken: identity.cartToken,
      userId: identity.userId,
    });

    const { cart, changes, minOrderSum, isMinOrderReached, stockByOfferId } =
      await validateAndPersistCart(identity, {
        deliverySlot: body.deliverySlot ?? null,
        items: body.items ?? [],
      });

    console.log("[POST /api/cart/validate] Success, cartToken:", cart.cartToken);
    return NextResponse.json({
      cartToken: cart.cartToken,
      deliverySlot: cart.deliverySlot,
      items: cart.items,
      totals: cart.totals,
      changes,
      minOrderSum,
      isMinOrderReached,
      stockByOfferId,
    });
  } catch (err) {
    console.error("[POST /api/cart/validate] Error:", err);
    console.error("[POST /api/cart/validate] Error details:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json(
      {
        error: "server_error",
        details: process.env.NODE_ENV === "development" 
          ? (err instanceof Error ? err.message : String(err))
          : undefined,
      },
      { status: 500 }
    );
  }
}

