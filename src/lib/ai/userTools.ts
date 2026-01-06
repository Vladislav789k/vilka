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
  if (!userId) {
    console.warn("[toolGetMyAddresses] No userId provided");
    return { ok: false, error: "auth_required" };
  }
  try {
    const { rows } = await query(
      `SELECT id, label, address_line, city, latitude, longitude, is_default, comment
       FROM user_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    console.log(`[toolGetMyAddresses] Found ${rows.length} addresses for userId ${userId}`);
    return { ok: true, data: { addresses: rows } };
  } catch (e: any) {
    console.error("[toolGetMyAddresses] Error:", e);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolGetMyCart(identity: CartIdentity): Promise<ToolResult> {
  try {
    const cart = await getOrCreateCart(identity);
    console.log(`[toolGetMyCart] Cart for identity:`, {
      cartToken: identity.cartToken,
      userId: identity.userId,
      itemsCount: cart.items?.length ?? 0,
      items: cart.items?.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })) ?? []
    });
    return { ok: true, data: { cart } };
  } catch (e: any) {
    console.error("[toolGetMyCart] Error:", e);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolSearchMenuItems(args: { queryText: string; limit?: number }): Promise<ToolResult> {
  const q = (args.queryText ?? "").trim();
  if (!q) return { ok: false, error: "queryText is required" };
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
  
  try {
    // Use the same search logic as the /api/search endpoint for better results
    // Normalize the query (lowercase, trim, handle Cyrillic)
    const normalizedQuery = q.toLowerCase().trim();
    
    // Build a more flexible search query that handles:
    // 1. Exact matches (highest priority)
    // 2. Prefix matches
    // 3. Substring matches
    // 4. Case-insensitive matches
    
    const { rows } = await query(
      `SELECT 
         id, 
         name, 
         price, 
         discount_percent,
         (price * (1 - COALESCE(discount_percent, 0) / 100.0)) as final_price,
         image_url, 
         stock_qty, 
         is_available, 
         is_active,
         CASE
           WHEN LOWER(name) = LOWER($1) THEN 1
           WHEN LOWER(name) LIKE LOWER($1 || '%') THEN 2
           WHEN LOWER(name) LIKE LOWER('%' || $1 || '%') THEN 3
           ELSE 4
         END as match_priority
       FROM menu_items
       WHERE is_active = TRUE
         AND (
           LOWER(name) = LOWER($1)
           OR LOWER(name) LIKE LOWER($1 || '%')
           OR LOWER(name) LIKE LOWER('%' || $1 || '%')
         )
       ORDER BY 
         match_priority ASC,
         is_available DESC,
         final_price ASC,
         name ASC
       LIMIT ${limit}`,
      [normalizedQuery]
    );
    
    return { ok: true, data: { items: rows } };
  } catch (e: any) {
    console.error("[toolSearchMenuItems] Error:", e);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolGetMenuItemsByPrice(args: { 
  sortBy: "cheapest" | "most_expensive" | "biggest_discount" | "smallest_discount";
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
  try {
    let orderBy: string;
    switch (args.sortBy) {
      case "cheapest":
        orderBy = `(price * (1 - COALESCE(discount_percent, 0) / 100.0)) ASC, price ASC`;
        break;
      case "most_expensive":
        orderBy = `(price * (1 - COALESCE(discount_percent, 0) / 100.0)) DESC, price DESC`;
        break;
      case "biggest_discount":
        orderBy = `discount_percent DESC NULLS LAST, price DESC`;
        break;
      case "smallest_discount":
        orderBy = `discount_percent ASC NULLS LAST, price ASC`;
        break;
      default:
        return { ok: false, error: "Invalid sortBy value" };
    }
    
    const { rows } = await query(
      `SELECT 
         id, 
         name, 
         price, 
         discount_percent,
         (price * (1 - COALESCE(discount_percent, 0) / 100.0)) as final_price,
         image_url, 
         stock_qty, 
         is_available, 
         is_active
       FROM menu_items
       WHERE is_active = TRUE AND is_available = TRUE
       ORDER BY ${orderBy}
       LIMIT ${limit}`,
      []
    );
    return { ok: true, data: { items: rows } };
  } catch (e: any) {
    console.error("[toolGetMenuItemsByPrice] Error:", e);
    return { ok: false, error: String(e?.message ?? e) };
  }
}


