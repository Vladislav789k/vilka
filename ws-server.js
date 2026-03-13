/**
 * Minimal WebSocket server for real-time cart sync.
 *
 * Flow:
 * - Next.js API persists cart to Redis (key cart:user:{id} or cart:{token})
 * - API publishes { key, cart, stockByOfferId, changes, ts } to Redis channel "cart_updates"
 * - WS server subscribes and broadcasts updates to clients subscribed to that key
 *
 * Runs as a separate process (see docker-compose app command).
 */
const http = require("http");
const { WebSocketServer } = require("ws");
const { createClient } = require("redis");

const PORT = Number(process.env.CART_WS_PORT || 3001);
const PATH = "/ws/cart";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const APP_HTTP_BASE = process.env.CART_WS_APP_HTTP_BASE || "http://127.0.0.1:3000";

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function cartKeyFromCookies(cookies) {
  const userIdRaw = cookies["vilka_user_id"];
  const cartToken = cookies["vilka_cart"];
  const userId = userIdRaw ? parseInt(userIdRaw, 10) : null;
  if (userId && Number.isFinite(userId)) return `cart:user:${userId}`;
  if (cartToken) return `cart:${cartToken}`;
  return null;
}

async function main() {
  const server = http.createServer((req, res) => {
    // Basic health check
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server, path: PATH });

  // key -> Set<WebSocket>
  const subscribers = new Map();

  const redis = createClient({ url: REDIS_URL });
  redis.on("error", (e) => console.error("[ws] redis error", e));
  await redis.connect();
  console.log("[ws] redis connected");

  await redis.subscribe("cart_updates", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const key = msg?.key;
    if (!key) return;
    const set = subscribers.get(key);
    if (!set || set.size === 0) return;
    const payload = JSON.stringify({ type: "cart:update", ...msg });
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(payload);
        } catch {}
      }
    }
  });

  wss.on("connection", (ws, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const key = cartKeyFromCookies(cookies);
    const cookieHeader = req.headers.cookie || "";

    if (!key) {
      ws.close(1008, "missing_cart_identity");
      return;
    }

    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(ws);

    ws.send(JSON.stringify({ type: "hello", key }));

    ws.on("close", () => {
      const s = subscribers.get(key);
      if (!s) return;
      s.delete(ws);
      if (s.size === 0) subscribers.delete(key);
    });

    // Client -> server cart sync (no HTTP polling from browser)
    ws.on("message", async (raw) => {
      const msg = safeJsonParse(raw);
      if (!msg || typeof msg !== "object") return;
      if (msg.type !== "cart:sync") return;

      const deliverySlot = msg.deliverySlot ?? null;
      const items = Array.isArray(msg.items) ? msg.items : [];

      // Validate shape minimally
      const normalized = [];
      for (const it of items) {
        const offerId = Number(it?.offerId);
        const quantity = Number(it?.quantity);
        if (!Number.isFinite(offerId) || !Number.isFinite(quantity)) continue;
        if (quantity <= 0) continue;
        normalized.push({ offerId, quantity });
      }

      try {
        const res = await fetch(`${APP_HTTP_BASE}/api/cart/validate`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // forward cookies so Next route resolves identity correctly
            cookie: cookieHeader,
          },
          body: JSON.stringify({ deliverySlot, items: normalized }),
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          try {
            ws.send(JSON.stringify({ type: "cart:error", status: res.status, error: err.slice(0, 400) }));
          } catch {}
        } else {
          const data = await res.json().catch(() => null);
          try {
            if (data && typeof data === "object") {
              ws.send(
                JSON.stringify({
                  type: "cart:update",
                  key,
                  cart: {
                    cartToken: data.cartToken,
                    deliverySlot: data.deliverySlot ?? null,
                    items: Array.isArray(data.items) ? data.items : [],
                    totals: data.totals ?? null,
                  },
                  changes: Array.isArray(data.changes) ? data.changes : [],
                  stockByOfferId:
                    data.stockByOfferId && typeof data.stockByOfferId === "object" ? data.stockByOfferId : {},
                  ts: Date.now(),
                })
              );
            } else {
              ws.send(JSON.stringify({ type: "cart:ack" }));
            }
          } catch {}
        }
      } catch (e) {
        try {
          ws.send(JSON.stringify({ type: "cart:error", status: 0, error: String(e) }));
        } catch {}
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[ws] cart ws server listening on :${PORT}${PATH}`);
  });
}

main().catch((e) => {
  console.error("[ws] fatal", e);
  process.exit(1);
});

