"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowUpRight, ChevronRight, X } from "lucide-react";

type ProfileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  user: {
    phone: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null;
};

type Screen = "main" | "addresses" | "settings" | "support";

const ANIM_MS = 500;

// TODO: потом можно вынести в конфиг/бек
const APP_VERSION = "2.67.2";
const SUPPORT_PHONE = "+74997150015";

export default function ProfileDrawer({ isOpen, onClose, user }: ProfileDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // держим компонент в DOM, пока проигрывается анимация закрытия
  const [shouldRender, setShouldRender] = useState(false);
  const [closing, setClosing] = useState(false);

  const [screen, setScreen] = useState<Screen>("main");

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
      setScreen("main"); // при каждом открытии возвращаемся на главный экран
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

  const ScreenTitle = (s: Screen) => {
    if (s === "addresses") return "Адреса";
    if (s === "settings") return "Настройки";
    if (s === "support") return "Связаться с нами";
    return "Профиль";
  };

  const TopBar = () => {
    const isMain = screen === "main";

    return (
      <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-7 sm:pt-7">
        {/* left */}
        <div className="flex items-center gap-2">
          {!isMain ? (
            <button
              type="button"
              onClick={() => setScreen("main")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              aria-label="Назад"
              title="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* center */}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-lg font-semibold text-slate-900">{ScreenTitle(screen)}</div>
        </div>

        {/* right */}
        <div className="flex items-center justify-end gap-2">
          {screen === "addresses" ? (
            <button
              type="button"
              onClick={() => {
                // TODO: включить режим редактирования адресов (удаление/переименование/выбор по умолчанию)
                console.log("edit addresses");
              }}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Изменить
            </button>
          ) : (
            <div className="w-[96px]" />
          )}

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
    );
  };

  const PlaceholderScreen = (title: string) => (
    <div className="px-6 pb-10 pt-10 sm:px-7">
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Экран «{title}» пока в разработке.
      </div>
    </div>
  );

  const AddressesScreen = () => {
    // временные данные (позже подключим к твоему реальному стору/беку)
    const items = [
      {
        id: "1",
        title: "Студенческая улица, 22 к3",
        subtitle: "Москва",
      },
      {
        id: "2",
        title: "Надсоновская улица, 1",
        subtitle: "Пушкино · кв. 16, подъезд 1, этаж 4",
      },
      {
        id: "3",
        title: "улица Студенческая, 22 к3",
        subtitle: "Москва · кв. 58, подъезд 6, этаж 4",
      },
    ];

    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-8 sm:px-7">
          <div className="space-y-2">
            {items.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  // TODO: открыть детали адреса / выбрать адрес по умолчанию
                  console.log("open address", a.id);
                }}
                className="flex w-full items-center justify-between rounded-2xl px-1 py-3 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-800">{a.title}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-400">{a.subtitle}</div>
                </div>
                <ChevronRight className="h-6 w-6 shrink-0 text-slate-200" />
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-6 pb-7 sm:px-7">
          <button
            type="button"
            onClick={() => {
              // TODO: открыть форму нового адреса (внутри drawer'а отдельным экраном)
              console.log("new address");
            }}
            className="vilka-btn-primary h-14 w-full rounded-full px-6 text-base font-semibold"
          >
            Новый адрес
          </button>
        </div>
      </div>
    );
  };

  const SupportScreen = () => (
    <div className="relative flex h-full flex-col">
      {/* центр */}
      <div className="flex flex-1 items-center justify-center px-6 sm:px-7">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-6 text-center">
          <button
            type="button"
            onClick={() => {
              // TODO: сюда подключим реальный чат (telegram/виджет/страница)
              console.log("open support chat");
            }}
            className="group inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold text-slate-700 hover:bg-emerald-50"
          >
            <span>В чате</span>
            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
          </button>

          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="group inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold text-slate-800 hover:bg-emerald-50"
          >
            <span className="tabular-nums">{SUPPORT_PHONE}</span>
            <ArrowUpRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600" />
          </a>
        </div>
      </div>

      {/* низ как на скрине */}
      <div className="shrink-0 bg-slate-50 px-6 py-5 text-center text-sm font-medium text-slate-500 sm:px-7">
        Версия веб-приложения {APP_VERSION}
      </div>
    </div>
  );

  const MainScreen = () => (
    <div className="px-6 pb-10 pt-6 sm:px-7">
      <div className="text-left">
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
              <div className="mt-1 text-xs text-slate-500">Тут будет карточка заказа, когда подключишь историю</div>
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
          onClick={() => setScreen("addresses")}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
        >
          Адреса
          <span className="text-slate-300">›</span>
        </button>

        <button
          type="button"
          onClick={() => setScreen("settings")}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
        >
          Настройки
          <span className="text-slate-300">›</span>
        </button>

        <button
          type="button"
          onClick={() => setScreen("support")}
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
  );

  const Content = () => {
    if (screen === "addresses") return <AddressesScreen />;
    if (screen === "support") return <SupportScreen />;
    if (screen === "settings") return <div className="h-full overflow-y-auto">{PlaceholderScreen("Настройки")}</div>;
    return <div className="h-full overflow-y-auto">{<MainScreen />}</div>;
  };

  const contentWrapClass =
    screen === "addresses" || screen === "support"
      ? "min-h-0 flex-1 overflow-hidden"
      : "min-h-0 flex-1 overflow-hidden"; // main/settings внутри сами имеют overflow-y-auto

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <div
        className={["profile-drawer-overlay absolute inset-0 bg-black/45", closing ? "closing" : ""].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* drawer */}
      <div
        className={["profile-drawer-panel absolute inset-y-0 right-0 w-full max-w-[520px] p-4 sm:p-5", closing ? "closing" : ""].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Профиль"
      >
        <div className="relative h-full overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <div className="flex h-full flex-col">
            <TopBar />
            <div className={contentWrapClass}>
              <Content />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
