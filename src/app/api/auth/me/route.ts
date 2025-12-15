// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdStr = cookieStore.get("vilka_user_id")?.value;
    
    console.log("[auth/me] vilka_user_id cookie:", userIdStr || "not found");

    if (!userIdStr) {
      return NextResponse.json({ user: null });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ user: null });
    }

    const { rows } = await query<{ id: number; phone: string; role: string }>(
      `SELECT id, phone, role FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ user: null });
  }
}
