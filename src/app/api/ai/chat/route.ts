import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, type OllamaMessage } from "@/lib/ai/ollama";
import { toolGetMyAddresses, toolGetMyCart, toolGetMyProfile, toolSearchMenuItems } from "@/lib/ai/userTools";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolCall =
  | { tool: "my_profile"; args: Record<string, never> }
  | { tool: "my_addresses"; args: Record<string, never> }
  | { tool: "my_cart"; args: Record<string, never> }
  | { tool: "search_menu_items"; args: { queryText: string; limit?: number } };

type ModelAction =
  | { type: "final"; answer: string }
  | { type: "tool_calls"; calls: ToolCall[] };

function safeJsonParse(input: string): any | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function getUserIdFromCookie(req: NextRequest): number | null {
  const raw = req.cookies.get("vilka_user_id")?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const SYSTEM_PROMPT = `
Ты — чат-бот ассистент для пользователей сервиса доставки еды «Вилка».
Ты умеешь отвечать на вопросы про корзину, адреса доставки и блюда. Для персональных данных ты можешь использовать инструменты (только чтение).

Правила:
- Если пользователь не авторизован, ты НЕ можешь видеть его корзину/адреса — попроси войти.
- Никаких действий, меняющих данные (ни в БД, ни в Redis).
- Если данных не хватает — сначала вызови инструменты, затем ответь.
- Возвращай ТОЛЬКО валидный JSON без markdown.

Формат ответа (строго один из):

1) Запрос инструментов:
{
  "type": "tool_calls",
  "calls": [
    { "tool": "my_profile", "args": {} },
    { "tool": "my_addresses", "args": {} },
    { "tool": "my_cart", "args": {} },
    { "tool": "search_menu_items", "args": { "queryText": "строка", "limit": 10 } }
  ]
}

2) Финальный ответ пользователю:
{ "type": "final", "answer": "..." }
`.trim();

async function runToolCall(call: ToolCall, ctx: { userId: number | null; cartIdentity: any }) {
  switch (call.tool) {
    case "my_profile":
      return await toolGetMyProfile(ctx.userId);
    case "my_addresses":
      return await toolGetMyAddresses(ctx.userId);
    case "my_cart":
      return await toolGetMyCart(ctx.cartIdentity);
    case "search_menu_items":
      return await toolSearchMenuItems(call.args);
    default:
      return { ok: false, error: "Unknown tool" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as null | { messages: ChatMessage[] };
    if (!body?.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const userId = getUserIdFromCookie(req);
    const cartIdentity = await resolveCartIdentity();

  const userMessages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);

  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

    const MAX_TURNS = 4;
    for (let step = 0; step < MAX_TURNS; step++) {
      let content: string;
      try {
        const resp = await ollamaChat(messages);
        content = resp.content;
      } catch (e: any) {
        return NextResponse.json(
          {
            error: "llm_unavailable",
            details:
              process.env.NODE_ENV === "development"
                ? String(e?.message ?? e)
                : undefined,
          },
          { status: 503 }
        );
      }
      const parsed = safeJsonParse(content) as ModelAction | null;

      if (!parsed || (parsed.type !== "final" && parsed.type !== "tool_calls")) {
        // if model didn't comply, ask it again with a stronger hint
        messages.push({
          role: "assistant",
          content: `{"type":"tool_calls","calls":[]}`,
        });
        continue;
      }

      if (parsed.type === "final") {
        return NextResponse.json({ answer: parsed.answer });
      }

      // tools
      const calls = Array.isArray(parsed.calls) ? parsed.calls.slice(0, 4) : [];
      const results = [];
      for (const c of calls) {
        results.push({ tool: c.tool, result: await runToolCall(c as ToolCall, { userId, cartIdentity }) });
      }

      messages.push({ role: "assistant", content });
      messages.push({ role: "tool", content: JSON.stringify({ results }) });
    }

    return NextResponse.json(
      { error: "Model did not produce a final answer in time" },
      { status: 504 }
    );
  } catch (e: any) {
    console.error("[POST /api/ai/chat]", e);
    return NextResponse.json(
      {
        error: "server_error",
        details:
          process.env.NODE_ENV === "development" ? String(e?.message ?? e) : undefined,
      },
      { status: 500 }
    );
  }
}


