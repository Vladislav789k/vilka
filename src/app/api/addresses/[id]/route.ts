// app/api/addresses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";

type PatchAddressRequest = {
  label?: string | null;
  address_line?: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  comment?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  floor?: string | null;
  intercom?: string | null;
  door_code_extra?: string | null;
  set_default?: boolean;
};

// PATCH - обновить адрес (и/или сделать его адресом по умолчанию)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v != null && !Array.isArray(v);

    const resolvedParams = await Promise.resolve(params);
    const addressIdStr = resolvedParams.id;

    const cookieStore = await cookies();
    const userIdStr = cookieStore.get("vilka_user_id")?.value;
    if (!userIdStr) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const userId = parseInt(userIdStr, 10);
    const addressId = parseInt(addressIdStr, 10);
    if (isNaN(userId) || isNaN(addressId)) {
      return NextResponse.json({ error: "Неверный userId или addressId" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchAddressRequest;

    // Проверяем ownership
    const { rows: checkRows } = await query<{ id: number }>(
      `SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );
    if (checkRows.length === 0) {
      return NextResponse.json({ error: "Адрес не найден" }, { status: 404 });
    }

    const setDefault = body.set_default === true;
    if (setDefault) {
      await query(`UPDATE user_addresses SET is_default = false WHERE user_id = $1`, [userId]);
    }

    await query(
      `
      UPDATE user_addresses
      SET
        label = COALESCE($1, label),
        address_line = COALESCE($2, address_line),
        city = COALESCE($3, city),
        latitude = COALESCE($4, latitude),
        longitude = COALESCE($5, longitude),
        comment = COALESCE($6, comment),
        apartment = COALESCE($7, apartment),
        entrance = COALESCE($8, entrance),
        floor = COALESCE($9, floor),
        intercom = COALESCE($10, intercom),
        door_code_extra = COALESCE($11, door_code_extra),
        is_default = CASE WHEN $12 THEN true ELSE is_default END,
        updated_at = now()
      WHERE id = $13 AND user_id = $14
      `,
      [
        body.label ?? null,
        body.address_line ?? null,
        body.city ?? null,
        body.latitude ?? null,
        body.longitude ?? null,
        body.comment ?? null,
        body.apartment ?? null,
        body.entrance ?? null,
        body.floor ?? null,
        body.intercom ?? null,
        body.door_code_extra ?? null,
        setDefault,
        addressId,
        userId,
      ]
    );

    const { rows } = await query(
      `SELECT id, label, address_line, city, latitude, longitude, is_default,
              apartment, entrance, floor, intercom, door_code_extra, comment
       FROM user_addresses
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [addressId, userId]
    );

    const raw: unknown = rows[0];
    if (!isRecord(raw)) {
      return NextResponse.json({ error: "Адрес не найден" }, { status: 404 });
    }
    const id = Number(raw.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Адрес не найден" }, { status: 404 });
    }

    const address = {
      ...raw,
      id,
      city: typeof raw.city === "string" ? raw.city : "",
      label:
        typeof raw.label === "string"
          ? raw.label
          : typeof raw.address_line === "string"
          ? raw.address_line
          : "",
    };
    return NextResponse.json({ address });
  } catch (e: unknown) {
    console.error("[addresses PATCH] Error:", e);
    const message = e instanceof Error ? e.message : null;
    return NextResponse.json(
      { error: "Ошибка сервера", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}

// DELETE - удалить адрес
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // В Next.js 16 params может быть Promise
    const resolvedParams = await Promise.resolve(params);
    const addressIdStr = resolvedParams.id;

    // Получаем userId из cookies
    const cookieStore = await cookies();
    const userIdStr = cookieStore.get("vilka_user_id")?.value;

    console.log("[addresses DELETE] userId from cookie:", userIdStr);
    console.log("[addresses DELETE] addressId from params:", addressIdStr);

    if (!userIdStr) {
      console.log("[addresses DELETE] No userId in cookie, returning 401");
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = parseInt(userIdStr, 10);
    const addressId = parseInt(addressIdStr, 10);

    console.log("[addresses DELETE] Parsed userId:", userId, "addressId:", addressId);

    if (isNaN(userId) || isNaN(addressId)) {
      console.log("[addresses DELETE] Invalid userId or addressId");
      return NextResponse.json(
        { error: "Неверный userId или addressId" },
        { status: 400 }
      );
    }

    // Проверяем, что адрес принадлежит пользователю
    console.log("[addresses DELETE] Checking if address exists for user");
    const { rows: checkRows } = await query<{ id: number }>(
      `SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );

    console.log("[addresses DELETE] Found addresses:", checkRows.length);

    if (checkRows.length === 0) {
      console.log("[addresses DELETE] Address not found or doesn't belong to user");
      return NextResponse.json(
        { error: "Адрес не найден" },
        { status: 404 }
      );
    }

    // Удаляем адрес
    console.log("[addresses DELETE] Executing DELETE query");
    const deleteResult = await query(
      `DELETE FROM user_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );

    console.log("[addresses DELETE] Delete result:", deleteResult);

    // Проверяем, что адрес действительно удален
    const { rows: verifyRows } = await query<{ id: number }>(
      `SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );

    if (verifyRows.length > 0) {
      console.error("[addresses DELETE] Address still exists after deletion!");
      return NextResponse.json(
        { error: "Не удалось удалить адрес" },
        { status: 500 }
      );
    }

    console.log("[addresses DELETE] Address deleted successfully");
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("[addresses DELETE] Error:", e);
    const message = e instanceof Error ? e.message : null;
    return NextResponse.json(
      { 
        error: "Ошибка сервера",
        details: process.env.NODE_ENV === "development" ? message : undefined
      },
      { status: 500 }
    );
  }
}
