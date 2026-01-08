import { query } from "@/lib/db";
import type { CartIdentity } from "@/modules/cart/cartIdentity";
import { getOrCreateCart } from "@/modules/cart/cartRepository";

export type ToolResult = { ok: boolean; data?: any; error?: string };

export async function toolGetMyProfile(userId: number | null): Promise<ToolResult> {
  if (!userId) return { ok: false, error: "auth_required" };
  try {
    const { rows } = await query<{ id: number; phone: string; role: string }>(
      `SELECT id, phone, role FROM users WHERE id=$1 AND is_active=true`,
      [userId]
    );
    return { ok: true, data: { user: rows[0] ?? null } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolGetMyAddresses(userId: number | null): Promise<ToolResult> {
  if (!userId) return { ok: false, error: "auth_required" };
  try {
    const { rows } = await query(
      `SELECT id, label, address_line, city, latitude, longitude, is_default, comment
       FROM user_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return { ok: true, data: { addresses: rows } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolGetMyCart(identity: CartIdentity): Promise<ToolResult> {
  try {
    const cart = await getOrCreateCart(identity);
    return { ok: true, data: cart };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolSearchMenuItems(args: { queryText: string; limit?: number }): Promise<ToolResult> {
  const q = (args.queryText ?? "").trim();
  if (!q) return { ok: false, error: "queryText is required" };
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
  try {
    const { rows } = await query(
      `SELECT id, name, price, discount_percent, image_url, stock_qty, is_available, is_active
       FROM menu_items
       WHERE LOWER(name) LIKE LOWER($1)
       ORDER BY is_active DESC, is_available DESC, created_at DESC
       LIMIT ${limit}`,
      [`%${q}%`]
    );
    return { ok: true, data: { items: rows } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}


