// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function clearCookieAndRespond(redirect: boolean, reqUrl?: string) {
  try {
    const store = await cookies();
    const before = store.get("vilka_user_id")?.value;
    console.log("[auth/logout] incoming vilka_user_id cookie:", before);
    console.log("[auth/logout] request cookies:", store.getAll().map((c) => `${c.name}=${c.value}`).join("; "));

    const res = redirect && reqUrl
      ? NextResponse.redirect(new URL("/", reqUrl))
      : NextResponse.json({ success: true, before });

    // 1) Удаляем cookie авторизации
    res.cookies.set("vilka_user_id", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    // 2) Важно: сбрасываем cartToken cookie.
    // Иначе после logout пользователь может видеть "старую" корзину по cartToken.
    // Корзина пользователя в Redis при этом НЕ удаляется (ключ cart:user:{id} остаётся).
    res.cookies.set("vilka_cart", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    console.log("[auth/logout] Set-Cookie header sent for deletion");
    console.log("[auth/logout] Response headers:", Object.fromEntries(res.headers.entries()));

    return res;
  } catch (e) {
    console.error("[auth/logout] unexpected error", e);
    return NextResponse.json({ success: false, error: "logout_failed", details: (e as any)?.message }, { status: 500 });
  }
}

export async function POST() {
  return clearCookieAndRespond(false);
}

export async function GET(request: Request) {
  return clearCookieAndRespond(true, request.url);
}
