"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ProfileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  user: {
    phone: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null;
};

const ANIM_MS = 500;

export default function ProfileDrawer({ isOpen, onClose, user }: ProfileDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // держим компонент в DOM, пока проигрывается анимация закрытия
  const [shouldRender, setShouldRender] = useState(false);
  const [closing, setClosing] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // реагируем на isOpen (в т.ч. если родитель закрыл сразу)
  useEffect(() => {
    if (!mounted) return;

    // открытие
    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setShouldRender(true);
      setClosing(false);
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

  // Esc
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!mounted || !shouldRender) return null;

  const titleLine =
    !user
      ? "Гость"
      : user.phone.startsWith("tg:")
      ? user.telegram?.username
        ? `@${user.telegram.username}`
        : user.telegram?.firstName || user.telegram?.lastName
        ? `Telegram • ${(user.telegram.firstName ?? "").trim()} ${(user.telegram.lastName ?? "").trim()}`.trim()
        : "Telegram"
      : user.phone;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <div
        className={[
          "profile-drawer-overlay absolute inset-0 bg-black/45",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* drawer */}
      <div
        className={[
          "profile-drawer-panel absolute inset-y-0 right-0 w-full max-w-[520px] p-4 sm:p-5",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Профиль"
      >
        <div className="relative h-full overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="h-full overflow-y-auto p-6 sm:p-7">
            <div className="pr-12">
              <div className="text-2xl font-semibold tracking-tight text-slate-900">Профиль</div>
              <div className="mt-1 text-sm text-slate-500">{titleLine}</div>
            </div>

            <div className="mt-8">
              <div className="text-lg font-semibold text-slate-900">История заказов</div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100"
                >
                  <div className="flex -space-x-2">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-sm" />
                    <div className="h-10 w-10 rounded-xl bg-white shadow-sm" />
                    <div className="h-10 w-10 rounded-xl bg-white shadow-sm" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Последний заказ</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Тут будет карточка заказа, когда подключишь историю
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900">Все заказы</span>
                  <span className="text-slate-400">→</span>
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-1">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
              >
                Адреса
                <span className="text-slate-300">›</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
              >
                Настройки
                <span className="text-slate-300">›</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
              >
                Связаться с нами
                <span className="text-slate-300">›</span>
              </button>

              <div className="pt-2">
                <a
                  href="/api/auth/logout"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.assign("/api/auth/logout");
                  }}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  Выйти
                  <span className="text-slate-200">›</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
