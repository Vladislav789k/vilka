"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowUpRight, ChevronRight, X, Phone, UserRound, Mail, IdCard } from "lucide-react";
import AddressModal from "@/components/AddressModal";

type DbAddress = {
  id: number;
  label: string | null;
  address_line: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  door_code_extra: string | null;
  comment: string | null;
};

// Simple in-memory cache to avoid list "blinking" and extra refetches.
// Keyed by user phone (or "guest").
const ADDRESSES_CACHE_TTL_MS = 60_000;
const addressesCache: Record<string, { at: number; items: DbAddress[] }> = {};

type ProfileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  user: {
    phone: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null;
  currentAddressId?: number | null;
  onSelectAddress?: (address: {
    id: number;
    label: string;
    city: string;
    latitude: number;
    longitude: number;
    apartment?: string | null;
    entrance?: string | null;
    floor?: string | null;
    intercom?: string | null;
    door_code_extra?: string | null;
    comment?: string | null;
    is_default?: boolean;
  }) => void;
};

type Screen = "main" | "addresses" | "support" | "settings" | "settings_name" | "settings_email";

const ANIM_MS = 500;

// TODO: потом можно вынести в конфиг/бек
const APP_VERSION = "2.67.2";
const SUPPORT_PHONE = "+74997150015";

/* =========================
   Shared UI (OUTSIDE)
   ========================= */

function RowButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between py-4 text-left">
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div className="text-base font-semibold text-slate-800">{label}</div>
      </div>
      <ChevronRight className="h-6 w-6 text-slate-300" />
    </button>
  );
}

function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  // твои цвета: зелёный (on) + нормальный off
  const trackClass = disabled ? "bg-slate-200" : value ? "bg-emerald-500" : "bg-slate-200";

  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 pr-4">
        <div className={["text-base font-semibold", disabled ? "text-slate-300" : "text-slate-800"].join(" ")}>
          {title}
        </div>
        {subtitle ? (
          <div
            className={[
              "mt-0.5 truncate text-sm font-semibold",
              disabled ? "text-slate-200" : "text-slate-400",
            ].join(" ")}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-disabled={disabled ? true : undefined}
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        className={[
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-0 transition-colors",
          "focus:outline-none focus:ring-4 focus:ring-emerald-200",
          trackClass,
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-6" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

/* =========================
   Screens (OUTSIDE)
   ========================= */

function AddressesScreen({
  currentAddressId,
  onSelectAddress,
  onDone,
  cacheKey,
}: {
  currentAddressId: number | null;
  onSelectAddress?: ProfileDrawerProps["onSelectAddress"];
  onDone: () => void;
  cacheKey: string;
}) {
  const [items, setItems] = useState<DbAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const setItemsAndCache = (next: DbAddress[] | ((prev: DbAddress[]) => DbAddress[])) => {
    setItems((prev) => {
      const computed = typeof next === "function" ? (next as (p: DbAddress[]) => DbAddress[])(prev) : next;
      addressesCache[cacheKey] = { at: Date.now(), items: computed };
      return computed;
    });
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses");
      if (!res.ok) {
        setError(res.status === 401 ? "Нужно войти в аккаунт" : "Не удалось загрузить адреса");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { addresses?: DbAddress[] };
      const nextItems = Array.isArray(data.addresses) ? data.addresses : [];
      addressesCache[cacheKey] = { at: Date.now(), items: nextItems };
      setItems(nextItems);
    } catch {
      setError("Не удалось загрузить адреса");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = addressesCache[cacheKey];
    if (cached?.items?.length) {
      setItems(cached.items);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const formatSubtitle = (a: DbAddress) => {
    const parts: string[] = [];
    if (a.city) parts.push(a.city);
    const details: string[] = [];
    if (a.apartment) details.push(`кв. ${a.apartment}`);
    if (a.entrance) details.push(`подъезд ${a.entrance}`);
    if (a.floor) details.push(`этаж ${a.floor}`);
    if (a.intercom) details.push(`домофон ${a.intercom}`);
    if (details.length > 0) parts.push(details.join(", "));
    return parts.join(" · ");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-8 sm:px-7">
        {error ? (
          <div className="py-8 text-center">
            <div className="text-sm font-semibold text-slate-500">{error}</div>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
            >
              Повторить
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {loading && items.length === 0 ? (
              <div className="py-8 text-center text-sm font-semibold text-slate-400">Загружаем адреса…</div>
            ) : null}
            {loading && items.length > 0 ? (
              <div className="pb-2 text-xs font-semibold text-slate-400">Обновляем…</div>
            ) : null}
            {items.map((a) => {
              const isActive = currentAddressId != null && a.id === currentAddressId;
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-2xl px-1 py-2 hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={async () => {
                      // Optimistic default switch (avoid blinking), rollback on error
                      const prevItems = items;
                      setItemsAndCache((prev) =>
                        prev.map((x) => (x.id === a.id ? { ...x, is_default: true } : { ...x, is_default: false }))
                      );

                      const res = await fetch(`/api/addresses/${a.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ set_default: true }),
                      }).catch(() => null);

                      if (!res || !res.ok) {
                        // rollback
                        setItemsAndCache(prevItems);
                        const data = await res?.json?.().catch(() => ({} as any));
                        const msg = data && typeof (data as any).error === "string" ? (data as any).error : "Не удалось выбрать адрес";
                        alert(msg);
                        return;
                      }

                      if (onSelectAddress && a.latitude != null && a.longitude != null) {
                        onSelectAddress({
                          id: a.id,
                          label: a.address_line,
                          city: a.city ?? "",
                          latitude: a.latitude,
                          longitude: a.longitude,
                          apartment: a.apartment,
                          entrance: a.entrance,
                          floor: a.floor,
                          intercom: a.intercom,
                          door_code_extra: a.door_code_extra,
                          comment: a.comment,
                          is_default: true,
                        });
                        onDone();
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between rounded-2xl px-1 py-3 text-left"
                    title={a.is_default ? "Адрес по умолчанию" : "Сделать адресом по умолчанию"}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-800">
                        {a.address_line}
                        {a.is_default ? <span className="ml-2 text-xs font-bold text-emerald-600">по умолчанию</span> : null}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-slate-400">{formatSubtitle(a)}</div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {isActive ? <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                      <ChevronRight className="h-6 w-6 shrink-0 text-slate-200" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      // Optimistic remove (avoid "doesn't delete"), rollback on error
                      const prevItems = items;
                      setItemsAndCache((prev) => prev.filter((x) => x.id !== a.id));

                      const res = await fetch(`/api/addresses/${a.id}`, { method: "DELETE" }).catch(() => null);
                      if (!res || !res.ok) {
                        setItemsAndCache(prevItems);
                        const data = await res?.json?.().catch(() => ({} as any));
                        const msg =
                          data && typeof (data as any).error === "string"
                            ? (data as any).error
                            : "Не удалось удалить адрес";
                        alert(msg);
                      }
                    }}
                    className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Удалить
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 pb-7 sm:px-7">
        <button
          type="button"
          onClick={() => setIsAddressModalOpen(true)}
          className="vilka-btn-primary h-14 w-full rounded-full px-6 text-base font-semibold"
        >
          Новый адрес
        </button>
      </div>

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSelectAddress={(address) => {
          setIsAddressModalOpen(false);
          // Update list locally (no refetch). New address is created as default.
          setItemsAndCache((prev) => {
            const next = prev.map((x) => ({ ...x, is_default: false }));
            const a: DbAddress = {
              id: address.id,
              label: null,
              address_line: address.label,
              city: address.city ?? null,
              latitude: address.latitude,
              longitude: address.longitude,
              is_default: true,
              apartment: null,
              entrance: null,
              floor: null,
              intercom: null,
              door_code_extra: null,
              comment: null,
            };
            return [a, ...next];
          });
          onSelectAddress?.(address as any);
          onDone();
        }}
      />
    </div>
  );
}

function SupportScreen() {
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-6 sm:px-7">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-6 text-center">
          <button
            type="button"
            onClick={() => console.log("open support chat")}
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

      <div className="shrink-0 bg-slate-50 px-6 py-5 text-center text-sm font-medium text-slate-500 sm:px-7">
        Версия веб-приложения {APP_VERSION}
      </div>
    </div>
  );
}

function SettingsMainScreen({
  user,
  shareData,
  setShareData,
  pushInApp,
  setPushInApp,
  sms,
  setSms,
  hasEmail,
  emailLetters,
  setEmailLetters,
  onAddName,
  onAddEmail,
  onBindSberId,
  onDeleteAccount,
}: {
  user: ProfileDrawerProps["user"];
  shareData: boolean;
  setShareData: (v: boolean) => void;
  pushInApp: boolean;
  setPushInApp: (v: boolean) => void;
  sms: boolean;
  setSms: (v: boolean) => void;
  hasEmail: boolean;
  emailLetters: boolean;
  setEmailLetters: (v: boolean) => void;
  onAddName: () => void;
  onAddEmail: () => void;
  onBindSberId: () => void;
  onDeleteAccount: () => void;
}) {
  const displayPhone = !user ? "+7 900 000 00 00" : user.phone.startsWith("tg:") ? "+7 900 000 00 00" : user.phone;

  return (
    <div className="h-full overflow-y-auto px-6 pb-10 pt-6 sm:px-7">
      {/* Профиль */}
      <div className="text-2xl font-semibold tracking-tight text-slate-900">Профиль</div>

      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        <div className="flex items-center gap-3 py-4">
          <Phone className="h-5 w-5 text-slate-400" />
          <div className="text-base font-semibold text-slate-800">{displayPhone}</div>
        </div>

        <RowButton icon={<UserRound className="h-5 w-5" />} label="Добавить имя" onClick={onAddName} />
        <RowButton icon={<Mail className="h-5 w-5" />} label="Добавить почту" onClick={onAddEmail} />
        <RowButton icon={<IdCard className="h-5 w-5" />} label="Привязать Сбер ID" onClick={onBindSberId} />
      </div>

      {/* Разрешения */}
      <div className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">Разрешения</div>
      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        <SwitchRow title="Делиться данными" subtitle="С партнёрами Вилки" value={shareData} onChange={setShareData} />
      </div>

      {/* Уведомления */}
      <div className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">Уведомления</div>
      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        <SwitchRow title="Пуши в приложении" value={pushInApp} onChange={setPushInApp} />
        <SwitchRow
          title="Письма на почту"
          subtitle="Сначала укажите её в настройках"
          value={emailLetters}
          onChange={setEmailLetters}
          disabled={!hasEmail}
        />
        <SwitchRow title="Смс" value={sms} onChange={setSms} />
      </div>

      <div className="mt-10 flex justify-center">
        <button type="button" onClick={onDeleteAccount} className="text-base font-semibold text-rose-500 hover:text-rose-600">
          Удалить аккаунт
        </button>
      </div>
    </div>
  );
}

function SettingsEmailScreen({
  emailDraft,
  setEmailDraft,
  onSendCode,
}: {
  emailDraft: string;
  setEmailDraft: (v: string) => void;
  onSendCode: () => void;
}) {
  const canSend = emailDraft.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 px-6 sm:px-7">
        <div className="flex h-full flex-col items-center justify-center gap-10">
          <div className="w-full max-w-[360px] text-center">
            <div className="text-sm font-semibold text-slate-400">Почта</div>
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              type="email"
              inputMode="email"
              placeholder="example@mail.com"
              className="mt-4 w-full border-b border-slate-200 bg-transparent pb-2 text-center text-base font-semibold text-slate-800 placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onSendCode}
            disabled={!canSend}
            className={[
              "h-14 w-full max-w-[420px] rounded-full px-6 text-base font-semibold",
              "vilka-btn-primary",
              !canSend ? "opacity-50" : "",
            ].join(" ")}
          >
            Получить код
          </button>
        </div>
      </div>

      <div className="px-6 pb-7 text-sm font-medium leading-relaxed text-slate-500 sm:px-7">
        На почту присылаем чеки, а также письма об акциях и скидках, если вы подписались на них в настройках уведомлений
      </div>
    </div>
  );
}

function SettingsNameScreen({
  nameDraft,
  setNameDraft,
  onSave,
}: {
  nameDraft: string;
  setNameDraft: (v: string) => void;
  onSave: () => void;
}) {
  const canSave = nameDraft.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 px-6 sm:px-7">
        <div className="flex h-full flex-col items-center justify-center">
          <div className="w-full max-w-[360px] text-center">
            <div className="text-sm font-semibold text-slate-400">Имя</div>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              type="text"
              inputMode="text"
              placeholder=""
              className="mt-4 w-full border-b border-slate-200 bg-transparent pb-2 text-center text-base font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="px-6 pb-7 sm:px-7">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={[
            "vilka-btn-primary h-14 w-full rounded-full px-6 text-base font-semibold",
            !canSave ? "opacity-50" : "",
          ].join(" ")}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

/* =========================
   Main component
   ========================= */

export default function ProfileDrawer({ isOpen, onClose, user, currentAddressId, onSelectAddress }: ProfileDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // держим компонент в DOM, пока проигрывается анимация закрытия
  const [shouldRender, setShouldRender] = useState(false);
  const [closing, setClosing] = useState(false);

  // навигация внутри drawer (чтобы "назад" возвращал на предыдущий экран)
  const [screenStack, setScreenStack] = useState<Screen[]>(["main"]);
  const screen = screenStack[screenStack.length - 1];

  const timerRef = useRef<number | null>(null);

  // a11y focus
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Settings state (чтобы не сбрасывалось при переходах)
  const [shareData, setShareData] = useState(true);
  const [pushInApp, setPushInApp] = useState(true);
  const [sms, setSms] = useState(true);

  // пока email не хранится в user — делаем как на скрине: серый/disabled + подсказка
  const hasEmail = false;
  const [emailLetters, setEmailLetters] = useState(false);

  // формы "Имя" / "Почта"
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");

  const pushScreen = (s: Screen) => setScreenStack((prev) => [...prev, s]);
  const popScreen = () => setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  useEffect(() => setMounted(true), []);

  // реагируем на isOpen (в т.ч. если родитель закрыл сразу)
  useEffect(() => {
    if (!mounted) return;

    // открытие
    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setShouldRender(true);
      setClosing(false);
      setScreenStack(["main"]); // при каждом открытии возвращаемся на главный экран
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

  // lock body scroll while drawer is rendered (open or closing)
  useEffect(() => {
    if (!shouldRender) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [shouldRender]);

  // focus management
  useEffect(() => {
    if (!isOpen) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => closeBtnRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (shouldRender) return;
    lastFocusRef.current?.focus?.();
  }, [shouldRender]);

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

  const getTitles = (s: Screen) => {
    if (s === "addresses") return { visible: "Адреса", a11y: "Адреса" };
    if (s === "support") return { visible: "Связаться с нами", a11y: "Связаться с нами" };
    if (s === "settings") return { visible: "Настройки", a11y: "Настройки" };

    // формы внутри настроек — как на скрине: без текста в центре, но для a11y оставим
    if (s === "settings_name") return { visible: "", a11y: "Настройки — Имя" };
    if (s === "settings_email") return { visible: "", a11y: "Настройки — Почта" };

    return { visible: "Профиль", a11y: "Профиль" };
  };

  const TopBar = () => {
    const canGoBack = screenStack.length > 1;
    const t = getTitles(screen);

    return (
      <div className="px-6 pt-6 sm:px-7 sm:pt-7">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          {/* left */}
          <div className="flex items-center justify-start">
            {canGoBack ? (
              <button
                type="button"
                onClick={popScreen}
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
          <div className="min-w-0 text-center">
            <div id="profile-drawer-title" className="truncate text-lg font-semibold text-slate-900">
              {t.visible}
              {t.visible ? null : <span className="sr-only">{t.a11y}</span>}
            </div>
          </div>

          {/* right */}
          <div className="flex items-center justify-end gap-2">
            {screen === "addresses" ? (
              <button
                type="button"
                onClick={() => console.log("edit addresses")}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Изменить
              </button>
            ) : null}

            <button
              ref={closeBtnRef}
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
      </div>
    );
  };

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
          onClick={() => pushScreen("addresses")}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
        >
          Адреса
          <span className="text-slate-300">›</span>
        </button>

        <button
          type="button"
          onClick={() => pushScreen("settings")}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
        >
          Настройки
          <span className="text-slate-300">›</span>
        </button>

        <button
          type="button"
          onClick={() => pushScreen("support")}
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
    if (screen === "addresses")
      return (
        <AddressesScreen
          currentAddressId={currentAddressId ?? null}
          onSelectAddress={onSelectAddress}
          onDone={popScreen}
          cacheKey={user?.phone ?? "guest"}
        />
      );
    if (screen === "support") return <SupportScreen />;

    if (screen === "settings") {
      return (
        <SettingsMainScreen
          user={user}
          shareData={shareData}
          setShareData={setShareData}
          pushInApp={pushInApp}
          setPushInApp={setPushInApp}
          sms={sms}
          setSms={setSms}
          hasEmail={hasEmail}
          emailLetters={emailLetters}
          setEmailLetters={setEmailLetters}
          onAddName={() => pushScreen("settings_name")}
          onAddEmail={() => pushScreen("settings_email")}
          onBindSberId={() => console.log("bind sber id")}
          onDeleteAccount={() => console.log("delete account")}
        />
      );
    }

    if (screen === "settings_email") {
      return (
        <SettingsEmailScreen
          emailDraft={emailDraft}
          setEmailDraft={setEmailDraft}
          onSendCode={() => console.log("send email code", emailDraft)}
        />
      );
    }

    if (screen === "settings_name") {
      return (
        <SettingsNameScreen
          nameDraft={nameDraft}
          setNameDraft={setNameDraft}
          onSave={() => {
            console.log("save name", nameDraft);
            popScreen();
          }}
        />
      );
    }

    return (
      <div className="h-full overflow-y-auto">
        <MainScreen />
      </div>
    );
  };

  const contentWrapClass = "min-h-0 flex-1 overflow-hidden";

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
        className={[
          "profile-drawer-panel absolute inset-y-0 right-0 w-full max-w-[520px] p-4 sm:p-5",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
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
