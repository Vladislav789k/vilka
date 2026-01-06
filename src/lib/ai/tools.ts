import { query } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export type ToolResult = {
  ok: boolean;
  data?: any;
  error?: string;
};

function isReadOnlySql(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  // allow common read-only statements
  if (s.startsWith("select")) return true;
  if (s.startsWith("with")) return true; // CTE leading to select
  if (s.startsWith("show")) return true;
  if (s.startsWith("explain")) return true;
  // disallow everything else (insert/update/delete/copy/alter/drop/create/etc)
  return false;
}

export async function toolSqlQuery(args: { sql: string; params?: any[]; limit?: number }): Promise<ToolResult> {
  const { sql, params = [], limit = 200 } = args;
  if (!sql || typeof sql !== "string") return { ok: false, error: "sql is required" };
  if (!isReadOnlySql(sql)) return { ok: false, error: "Only read-only SQL is allowed (SELECT/EXPLAIN/SHOW)" };

  // hard cap
  const capped = Math.min(Math.max(limit, 1), 500);

  // If query doesn't contain LIMIT, we wrap to enforce cap for SELECT/CTE.
  const trimmed = sql.trim().replace(/;+\s*$/g, "");
  const lower = trimmed.toLowerCase();
  const hasLimit = /\blimit\b/.test(lower);
  const wrappedSql =
    hasLimit || lower.startsWith("explain") || lower.startsWith("show")
      ? trimmed
      : `SELECT * FROM (${trimmed}) AS _q LIMIT ${capped}`;

  try {
    const { rows } = await query(wrappedSql, params);
    return { ok: true, data: { rows } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolRedisGet(args: { key: string }): Promise<ToolResult> {
  const { key } = args;
  if (!key) return { ok: false, error: "key is required" };
  const redis = getRedis();
  if (!redis) return { ok: false, error: "Redis is not available (REDIS_URL not set)" };
  try {
    await redis.connect();
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);
    return { ok: true, data: { key, value, ttl } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolRedisScan(args: { pattern?: string; count?: number; limit?: number }): Promise<ToolResult> {
  const pattern = args.pattern ?? "*";
  const count = Math.min(Math.max(args.count ?? 100, 1), 1000);
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 1000);
  const redis = getRedis();
  if (!redis) return { ok: false, error: "Redis is not available (REDIS_URL not set)" };

  const keys: string[] = [];
  try {
    await redis.connect();
    for await (const k of redis.scanIterator({ MATCH: pattern, COUNT: count })) {
      keys.push(String(k));
      if (keys.length >= limit) break;
    }
    return { ok: true, data: { pattern, keys } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function toolRedisInfo(): Promise<ToolResult> {
  const redis = getRedis();
  if (!redis) return { ok: false, error: "Redis is not available (REDIS_URL not set)" };
  try {
    await redis.connect();
    const info = await redis.info();
    return { ok: true, data: { info } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}


