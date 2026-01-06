import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, type OllamaMessage } from "@/lib/ai/ollama";
import { toolGetMyAddresses, toolGetMyCart, toolGetMyProfile, toolSearchMenuItems, toolGetMenuItemsByPrice } from "@/lib/ai/userTools";
import { resolveCartIdentity } from "@/modules/cart/cartIdentity";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolCall =
  | { tool: "my_profile"; args: Record<string, never> }
  | { tool: "my_addresses"; args: Record<string, never> }
  | { tool: "my_cart"; args: Record<string, never> }
  | { tool: "search_menu_items"; args: { queryText: string; limit?: number } }
  | { tool: "get_menu_items_by_price"; args: { sortBy: "cheapest" | "most_expensive" | "biggest_discount" | "smallest_discount"; limit?: number } };

type ModelAction =
  | { type: "final"; answer: string }
  | { type: "tool_calls"; calls: ToolCall[] };

function safeJsonParse(input: string): any | null {
  try {
    // Try direct parse first
    return JSON.parse(input);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = input.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || input.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[1];
        // Try to fix truncated JSON (common issue)
        if (!jsonStr.trim().endsWith('}')) {
          // If it looks like it was cut off, try to close it
          if (jsonStr.includes('"answer"') && jsonStr.includes('"type"')) {
            // Find the last complete quote and close the JSON
            const lastQuote = jsonStr.lastIndexOf('"');
            if (lastQuote > 0) {
              jsonStr = jsonStr.substring(0, lastQuote + 1) + '}';
            }
          }
        }
        return JSON.parse(jsonStr);
      } catch {
        // Ignore
      }
    }
    return null;
  }
}

function getUserIdFromCookie(req: NextRequest): number | null {
  const raw = req.cookies.get("vilka_user_id")?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const SYSTEM_PROMPT = `Ты — чат-бот для доставки еды «Вилка». Отвечай на вопросы про корзину, адреса и блюда.

КРИТИЧНО:
- НЕ выдумывай данные — используй инструменты.
- НЕ отвечай о ценах без инструментов.
- НЕ говори "нет данных о поиске X" — ВСЕГДА вызывай search_menu_items для запросов о еде.
- ВАЖНО: Возвращай ТОЛЬКО валидный JSON, без текста до/после, без markdown. Только чистый JSON объект.

ПРАВИЛА ДЛЯ ЕДЫ:
- Одно слово/фраза (1-3 слова) про еду → ВСЕГДА search_menu_items.
- Примеры: "пицца", "шаурма", "вок", "суши", "кофе", "хочу пиццу", "есть вок?".
- НЕ жди "покажи" — если про еду, сразу ищи.
- Результаты: 1 элемент → покажи с ценой; 2-5 → список с ценами + "Уточнить?"; >5 → топ 5 + "Уточнить?"; пусто → "Не нашёл по «X». Уточните запрос."
- Держи ответы короткими (до 200 символов), особенно списки.

Формат ответа (строго один из, только JSON):
1) {"type":"tool_calls","calls":[{"tool":"search_menu_items","args":{"queryText":"пицца","limit":10}}]}
2) {"type":"final","answer":"..."}

Инструменты:
- search_menu_items: поиск блюд (args: {queryText, limit:10}) — для ВСЕХ запросов о еде
- get_menu_items_by_price: сортировка по цене (args: {sortBy:"cheapest"|"most_expensive"|"biggest_discount", limit:10})
- my_cart: корзина (args: {})
- my_addresses: адреса (args: {}, требует авторизации)
- my_profile: профиль (args: {}, требует авторизации)

Примеры (строго следуй формату):
"пицца" → {"type":"tool_calls","calls":[{"tool":"search_menu_items","args":{"queryText":"пицца","limit":10}}]}
"что в корзине?" → {"type":"tool_calls","calls":[{"tool":"my_cart","args":{}}]}
search вернул items=[{name:"Пицца",price:450}] → {"type":"final","answer":"Нашёл: Пицца за 450₽"}
search вернул items=[{name:"Пицца",price:450},{name:"Пицца Пепперони",price:550}] → {"type":"final","answer":"Нашёл: Пицца за 450₽, Пицца Пепперони за 550₽. Уточнить?"}
search вернул items=[] → {"type":"final","answer":"Не нашёл по «пицца». Уточните запрос."}`.trim();

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
    case "get_menu_items_by_price":
      return await toolGetMenuItemsByPrice(call.args);
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
    
    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[POST /api/ai/chat] userId: ${userId}, cartIdentity:`, cartIdentity);
    }

  const userMessages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);

  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

    const MAX_TURNS = 5;
    let lastInvalidResponse: string | null = null;
    
    for (let step = 0; step < MAX_TURNS; step++) {
      let content: string;
      try {
        const resp = await ollamaChat(messages);
        content = resp.content.trim();
      } catch (e: any) {
        console.error(`[POST /api/ai/chat] Ollama error at step ${step}:`, e);
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

      if (!content) {
        console.warn(`[POST /api/ai/chat] Empty response at step ${step}`);
        if (step === MAX_TURNS - 1) {
          return NextResponse.json(
            { error: "Модель не ответила. Попробуйте переформулировать вопрос." },
            { status: 504 }
          );
        }
        messages.push({
          role: "user",
          content: "Пожалуйста, ответь в формате JSON: {\"type\":\"final\",\"answer\":\"...\"}",
        });
        continue;
      }

      const parsed = safeJsonParse(content) as ModelAction | null;

      if (!parsed || (parsed.type !== "final" && parsed.type !== "tool_calls")) {
        lastInvalidResponse = content.substring(0, 200);
        console.warn(`[POST /api/ai/chat] Invalid JSON at step ${step}:`, content.substring(0, 100));
        
        if (step === MAX_TURNS - 1) {
          // Last attempt failed - return a helpful error
          return NextResponse.json(
            {
              error: "Модель вернула некорректный ответ. Попробуйте переформулировать вопрос.",
              details: process.env.NODE_ENV === "development" ? lastInvalidResponse : undefined,
            },
            { status: 504 }
          );
        }
        
        // Add a stronger hint with examples
        messages.push({
          role: "user",
          content: "Ошибка: ответ должен быть ТОЛЬКО валидным JSON без markdown, без текста до/после. Примеры:\n{\"type\":\"final\",\"answer\":\"Привет!\"}\n{\"type\":\"tool_calls\",\"calls\":[{\"tool\":\"search_menu_items\",\"args\":{\"queryText\":\"пицца\",\"limit\":10}}]}\n\nВерни ТОЛЬКО JSON, ничего больше.",
        });
        continue;
      }

      if (parsed.type === "final") {
        return NextResponse.json({ answer: parsed.answer || "Извините, не могу ответить на этот вопрос." });
      }

      // tools
      const calls = Array.isArray(parsed.calls) ? parsed.calls.slice(0, 4) : [];
      if (calls.length === 0) {
        // Empty tool calls - treat as final answer request
        if (step === MAX_TURNS - 1) {
          return NextResponse.json(
            { error: "Модель не смогла сформировать ответ. Попробуйте переформулировать вопрос." },
            { status: 504 }
          );
        }
        messages.push({
          role: "user",
          content: "Если у тебя есть ответ, верни {\"type\":\"final\",\"answer\":\"...\"}. Если нужны инструменты, укажи их в calls.",
        });
        continue;
      }

      const results = [];
      for (const c of calls) {
        try {
          results.push({ tool: c.tool, result: await runToolCall(c as ToolCall, { userId, cartIdentity }) });
        } catch (toolError: any) {
          console.error(`[POST /api/ai/chat] Tool error for ${c.tool}:`, toolError);
          results.push({ tool: c.tool, result: { ok: false, error: "Tool execution failed" } });
        }
      }

      messages.push({ role: "assistant", content });
      
      // Log tool results in development for debugging
      if (process.env.NODE_ENV === "development") {
        console.log(`[POST /api/ai/chat] Tool results at step ${step}:`, JSON.stringify(results, null, 2));
      }
      
      // Format tool results more compactly to reduce token usage and prevent truncation
      const compactResults = results.map(r => {
        if (!r.result.ok) {
          return { tool: r.tool, ok: false, error: r.result.error };
        }
        // For search results, limit items to top 5 to keep response short
        if (r.tool === "search_menu_items" && r.result.data?.items) {
          const items = Array.isArray(r.result.data.items) ? r.result.data.items.slice(0, 5) : [];
          return {
            tool: r.tool,
            ok: true,
            data: { items: items.map((item: any) => ({
              id: item.id,
              name: item.name,
              price: parseFloat(item.price) || 0,
              discount_percent: item.discount_percent ? parseFloat(item.discount_percent) : null,
              final_price: item.final_price ? parseFloat(item.final_price) : null,
            })) },
          };
        }
        return {
          tool: r.tool,
          ok: true,
          data: r.result.data || {},
        };
      });
      
      messages.push({ role: "tool", content: JSON.stringify({ results: compactResults }) });
    }

    return NextResponse.json(
      { error: "Модель не смогла сформировать ответ за отведенное время. Попробуйте переформулировать вопрос." },
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


