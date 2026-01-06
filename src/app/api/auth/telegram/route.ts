import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function computeTelegramHash(data: Record<string, unknown>, botToken: string): string {
  // https://core.telegram.org/widgets/login#checking-authorization
  const entries = Object.entries(data)
    .filter(([k, v]) => k !== "hash" && v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest(); // bytes
  return crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as TelegramAuthPayload;
    const { id, auth_date, hash } = payload ?? ({} as any);

    if (!id || typeof id !== "number" || !auth_date || typeof auth_date !== "number" || !hash) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    // Optional freshness check (24h)
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - auth_date) > 60 * 60 * 24) {
      return NextResponse.json({ error: "auth_too_old" }, { status: 401 });
    }

    const botToken = requiredEnv("TELEGRAM_AUTH_BOT_TOKEN");
    const computed = computeTelegramHash(payload as any, botToken);
    if (!timingSafeHexEqual(computed, hash)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    const { userId, phone } = await withTransaction(async (client) => {
      // Ensure schema exists (we don't auto-apply db/migrations in this project)
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.telegram_identities (
          telegram_id bigint PRIMARY KEY,
          user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          username text,
          first_name text,
          last_name text,
          photo_url text,
          last_auth_date bigint NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL,
          CONSTRAINT telegram_identities_user_id_key UNIQUE (user_id)
        );
      `);

      // 1) Existing identity?
      const existing = await client.query<{ user_id: number }>(
        `SELECT user_id FROM public.telegram_identities WHERE telegram_id = $1 LIMIT 1`,
        [id]
      );

      let userId: number;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].user_id;
      } else {
        // 2) Create user with stable placeholder phone (users.phone is NOT NULL + UNIQUE)
        const placeholderPhone = `tg:${id}`;
        const created = await client.query<{ id: number }>(
          `INSERT INTO public.users (phone, role, is_active, phone_verified, phone_verified_at)
           VALUES ($1, 'customer', true, true, now())
           ON CONFLICT (phone) DO UPDATE SET updated_at = now()
           RETURNING id`,
          [placeholderPhone]
        );
        userId = created.rows[0].id;

        await client.query(
          `INSERT INTO public.telegram_identities
            (telegram_id, user_id, username, first_name, last_name, photo_url, last_auth_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (telegram_id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             username = EXCLUDED.username,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             photo_url = EXCLUDED.photo_url,
             last_auth_date = EXCLUDED.last_auth_date,
             updated_at = now()`,
          [
            id,
            userId,
            payload.username ?? null,
            payload.first_name ?? null,
            payload.last_name ?? null,
            payload.photo_url ?? null,
            auth_date,
          ]
        );
      }

      const u = await client.query<{ phone: string }>(
        `SELECT phone FROM public.users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      return { userId, phone: u.rows[0]?.phone ?? `tg:${id}` };
    });

    const res = NextResponse.json({ ok: true, userId, phone });
    res.cookies.set("vilka_user_id", userId.toString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e: any) {
    console.error("[auth/telegram] error", e);
    return NextResponse.json(
      { error: "server_error", details: process.env.NODE_ENV === "development" ? e?.message : undefined },
      { status: 500 }
    );
  }
}


