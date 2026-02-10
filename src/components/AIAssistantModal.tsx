"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { createPortal } from "react-dom";

type Msg = { role: "user" | "assistant"; content: string; at: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const ANIM_MS = 500;

export default function AIAssistantModal({ isOpen, onClose }: Props) {
  const nowTime = () =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Привет! Я ваш виртуальный помощник. Чем помочь?", at: nowTime() },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesRef = useRef<Msg[]>(messages);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // --- как в ProfileDrawer: анимация open/close + удержание DOM ---
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // реагируем на isOpen (полностью как в профиле)
  useEffect(() => {
    if (!mounted) return;

    // открытие
    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setShouldRender(true);
      setClosing(false);
      setIsAtBottom(true);

      // дать панели появиться, потом скролл вниз
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 0);
      return;
    }

    // закрытие
    if (!isOpen && shouldRender) {
      setClosing(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setClosing(false);
      }, ANIM_MS);
    }
  }, [isOpen, mounted, shouldRender]);

  // очистка таймера
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // lock body scroll while rendered
  useEffect(() => {
    if (!shouldRender) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [shouldRender]);

  // автоскролл вниз при новых сообщениях
  useEffect(() => {
    if (!shouldRender) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, shouldRender]);

  const visible = useMemo(() => messages.slice(-60), [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    const nextMessages = [...messagesRef.current, { role: "user", content: text, at: nowTime() } as Msg];
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
        setMessages((prev) => [...prev, { role: "assistant", content: `Ошибка: ${err}`, at: nowTime() }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: (data as any).answer ?? "", at: nowTime() }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 16;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  if (!mounted || !shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* overlay — ВАЖНО: те же классы, что у профиля (для анимации) */}
      <div
        className={["profile-drawer-overlay absolute inset-0 bg-black/45", closing ? "closing" : ""].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel справа — ВАЖНО: те же классы, что у профиля (для анимации) */}
      <div
        className={[
          "profile-drawer-panel absolute inset-y-0 right-0 w-full max-w-[520px] p-4 sm:p-5",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Чат Вилки"
      >
        <div className="relative h-full overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <div className="flex h-full flex-col">
            {/* Header — отступы как у профиля */}
            <div className="px-6 pt-6 sm:px-7 sm:pt-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0">
                    <Image src="/logo.png" alt="Вилка" fill priority sizes="40px" className="object-contain" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <div className="text-sm font-semibold text-slate-900">Чат Вилки</div>
                    <div className="text-xs text-slate-500">Онлайн</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                  aria-label="Закрыть"
                  title="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <div
                ref={listRef}
                onScroll={handleScroll}
                className="relative h-full overflow-y-auto px-6 pb-6 pt-5 sm:px-7"
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
                        <div className="relative h-9 w-9 shrink-0">
                          <Image src="/logo.png" alt="Вилка" fill sizes="36px" className="object-contain" />
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
                    className="absolute right-6 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-vilka-soft"
                    title="Вниз"
                  >
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Input */}
            <div className="shrink-0 px-6 pb-6 sm:px-7 sm:pb-7">
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
      </div>
    </div>,
    document.body
  );
}
