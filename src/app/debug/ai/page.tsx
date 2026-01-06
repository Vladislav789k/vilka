"use client";

import { useEffect, useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AIDebugPage() {
  const [me, setMe] = useState<{ id: number; phone: string; role: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Я могу помочь проанализировать данные в Postgres/Redis (только чтение). Спроси, например: “Сколько активных блюд в меню?”",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const canUse = true;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  const visible = useMemo(() => messages.slice(-30), [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsSending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, { role: "user", content: text }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка: ${(data as any)?.error ?? res.status}` },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: (data as any).answer ?? "" }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-soft">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="rounded-3xl bg-white p-5 shadow-vilka-soft">
          <div className="text-lg font-semibold text-slate-900">AI ассистент</div>
          <div className="mt-1 text-sm text-slate-600">
            Можно задавать вопросы.
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Текущий пользователь: {me ? `${me.phone} (${me.role})` : "—"}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-vilka-soft">
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-auto pr-1">
            {visible.map((m, idx) => (
              <div
                key={idx}
                className={[
                  "rounded-2xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto max-w-[85%] bg-brand text-white"
                    : "mr-auto max-w-[85%] bg-surface-soft text-slate-900",
                ].join(" ")}
              >
                {m.content}
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={!canUse || isSending}
              placeholder={canUse ? "Задайте вопрос про данные..." : "Требуется admin"}
              className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={!canUse || isSending}
              className="vilka-btn-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isSending ? "..." : "Отправить"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}


