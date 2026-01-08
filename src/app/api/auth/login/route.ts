// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const TECHNICAL_USERS = {
  "0000": { id: 1, phone: "+79000000000" },
  "1111": { id: 2, phone: "+79111111111" },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    console.log("[auth/login] Received code:", code, typeof code);

    if (!code || typeof code !== "string") {
      console.log("[auth/login] Invalid code format");
      return NextResponse.json({ error: "Код не указан" }, { status: 400 });
    }

    const trimmedCode = code.trim();
    console.log("[auth/login] Trimmed code:", trimmedCode);
    
    const userConfig = TECHNICAL_USERS[trimmedCode as keyof typeof TECHNICAL_USERS];
    console.log("[auth/login] Found user config:", userConfig);

    if (!userConfig) {
      console.log("[auth/login] User not found for code:", trimmedCode);
      return NextResponse.json({ error: "Неверный код" }, { status: 401 });
    }

    let userId = userConfig.id;
    const userPhone = userConfig.phone;

    // Сначала проверяем, есть ли пользователь с таким телефоном
    const { rows: phoneUsers } = await query<{ id: number }>(
      `SELECT id FROM users WHERE phone = $1 AND is_active = true LIMIT 1`,
      [userPhone]
    );

    if (phoneUsers.length > 0) {
      // Пользователь с таким телефоном уже существует, используем его
      userId = phoneUsers[0].id;
      console.log("[auth/login] User with phone exists, using ID:", userId);
    } else {
      // Пользователя с таким телефоном нет, проверяем ID
      const { rows: idUsers } = await query<{ id: number }>(
        `SELECT id FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      if (idUsers.length > 0) {
        // ID занят, но телефон другой - создаем нового пользователя с автоматическим ID
        console.log("[auth/login] ID is taken, creating user with auto ID");
        const { rows: newUser } = await query<{ id: number }>(
          `INSERT INTO users (phone, role, is_active, phone_verified, phone_verified_at)
           VALUES ($1, 'customer', true, true, now())
           RETURNING id`,
          [userPhone]
        );
        userId = newUser[0].id;
        console.log("[auth/login] User created with auto ID:", userId);
      } else {
        // ID свободен, создаем пользователя с указанным ID
        try {
          console.log("[auth/login] Creating user with ID:", userId, userPhone);
          await query(
            `INSERT INTO users (id, phone, role, is_active, phone_verified, phone_verified_at)
             VALUES ($1, $2, 'customer', true, true, now())`,
            [userId, userPhone]
          );
          console.log("[auth/login] User created successfully");
        } catch (insertError: any) {
          console.error("[auth/login] Error creating user:", {
            message: insertError?.message,
            code: insertError?.code,
            constraint: insertError?.constraint,
          });
          // Если все еще ошибка, создаем с автоматическим ID
          const { rows: newUser } = await query<{ id: number }>(
            `INSERT INTO users (phone, role, is_active, phone_verified, phone_verified_at)
             VALUES ($1, 'customer', true, true, now())
             RETURNING id`,
            [userPhone]
          );
          userId = newUser[0].id;
          console.log("[auth/login] User created with auto ID after error:", userId);
        }
      }
    }

    // Устанавливаем сессию через NextResponse
    console.log("[auth/login] Setting cookie, returning success");

    const response = NextResponse.json({
      userId: userId,
      phone: userPhone,
    });

    response.cookies.set("vilka_user_id", userId.toString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (e: any) {
    console.error("[auth/login] Unexpected error:", e);
    console.error("[auth/login] Error details:", {
      message: e?.message,
      code: e?.code,
      constraint: e?.constraint,
      stack: e?.stack,
    });
    return NextResponse.json(
      { 
        error: "Ошибка сервера",
        details: process.env.NODE_ENV === "development" ? e?.message : undefined
      },
      { status: 500 }
    );
  }
}
