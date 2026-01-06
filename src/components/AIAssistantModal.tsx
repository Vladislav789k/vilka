"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Paperclip, Utensils, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; at: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AIAssistantModal({ isOpen, onClose }: Props) {
  const nowTime = () =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Привет! Я ваш виртуальный помощник. Чем помочь?",
      at: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesRef = useRef<Msg[]>(messages);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setIsAtBottom(true);
      // дать модалке появиться, потом скролл вниз
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visible = useMemo(() => messages.slice(-60), [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    const nextMessages = [
      ...messagesRef.current,
      { role: "user", content: text, at: nowTime() } as Msg,
    ];
    setMessages(nextMessages);
    setIsSending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as any)?.error ?? res.status;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка: ${err}`, at: nowTime() },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: (data as any).answer ?? "", at: nowTime() },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const closeModal = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => onClose(), 500);
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 16;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-end bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className={`auth-modal relative flex h-full w-full max-w-md flex-col rounded-[32px] bg-white p-6 sm:p-8 shadow-vilka-soft ${
          closing ? "closing" : ""
        }`}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
              <Utensils className="h-5 w-5 text-brand-dark" />
            </div>
            <div className="flex flex-col leading-tight">
              <div className="text-sm font-semibold text-slate-900">Чат Вилки</div>
              <div className="text-xs text-slate-500">Онлайн</div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-auto pr-1"
        >
          <div className="py-1 text-center text-xs font-semibold text-slate-300">Сегодня</div>

          <div className="mt-3 flex flex-col gap-3 pb-10">
            {visible.map((m, idx) => {
              if (m.role === "user") {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap vilka-btn-primary">
                      {m.content}
                      <div className="mt-1 text-right text-[11px] text-white/70">{m.at}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex items-end gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                    <Utensils className="h-4 w-4 text-brand-dark" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl bg-surface-soft px-3 py-2 text-sm text-slate-900 whitespace-pre-wrap">
                    {m.content}
                    <div className="mt-1 text-right text-[11px] text-slate-400">{m.at}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div ref={bottomRef} />

          {!isAtBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-vilka-soft"
              title="Вниз"
            >
              <ChevronDown className="h-4 w-4 text-slate-600" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="pt-4">
          <div className="flex items-center gap-2 rounded-2xl bg-surface-soft px-3 py-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white"
              title="Прикрепить"
              onClick={() => {}}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={isSending}
              placeholder="Введите сообщение"
              className="flex-1 bg-transparent px-1 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={isSending || !input.trim()}
              className="vilka-btn-primary rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {isSending ? "..." : "Отправить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


