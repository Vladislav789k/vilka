"use client";

import { useEffect, useState, ChangeEvent, useRef, KeyboardEvent } from "react";
import { ArrowLeft, X } from "lucide-react";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const MAX_PHONE_DIGITS = 10; // цифр после +7
const VALID_CODES = ["0000", "1111"]; // технические коды для авторизации
const ANIM_MS = 500;

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [closing, setClosing] = useState(false);

  // держим компонент в DOM, пока проигрывается анимация закрытия
  const [shouldRender, setShouldRender] = useState(false);
  const timerRef = useRef<number | null>(null);

  const telegramMountRef = useRef<HTMLDivElement | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const telegramBootedRef = useRef(false);
  const onSuccessRef = useRef<AuthModalProps["onSuccess"]>(onSuccess);

  // телефон: храним только цифры после +7
  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState(["", "", "", ""]);

  // состояние ошибки кода и таймер
  const [codeError, setCodeError] = useState(false);
  const [timer, setTimer] = useState(60);

  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // форматируем телефон как +7 916 152 50 95
  const formatPhone = (digits: string): string => {
    const d = digits.slice(0, MAX_PHONE_DIGITS);
    if (!d.length) return "+7";

    const parts: string[] = [];
    if (d.length > 0) parts.push(d.slice(0, Math.min(3, d.length)));
    if (d.length > 3) parts.push(d.slice(3, Math.min(6, d.length)));
    if (d.length > 6) parts.push(d.slice(6, Math.min(8, d.length)));
    if (d.length > 8) parts.push(d.slice(8, Math.min(10, d.length)));

    return "+7 " + parts.join(" ");
  };

  const phone = formatPhone(phoneDigits);
  const isPhoneComplete = phoneDigits.length === MAX_PHONE_DIGITS;

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // управляем "рендером" как у ProfileDrawer: открытие/закрытие с анимацией
  useEffect(() => {
    // открытие
    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setShouldRender(true);

      // сброс при открытии
      setStep("phone");
      setPhoneDigits("");
      setCode(["", "", "", ""]);
      setCodeError(false);
      setTimer(60);
      setClosing(false);
      setTelegramError(null);
      telegramBootedRef.current = false;

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
  }, [isOpen, shouldRender]);

  // очистка таймера
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const closeModal = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      onClose();
    }, ANIM_MS);
  };

  const closeAfterAuth = () => {
    if (closing) {
      onClose();
      return;
    }
    closeModal();
  };

  // Esc
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, closing]);

  // Telegram Login Widget (renders its own button)
  useEffect(() => {
    if (!isOpen) return;
    if (step !== "phone") return;

    const mount = telegramMountRef.current;
    if (!mount) return;

    // Avoid re-mounting widget on every render (prevents blinking)
    if (telegramBootedRef.current) return;
    telegramBootedRef.current = true;

    mount.innerHTML = "";

    (window as any).onTelegramAuth = async (user: any) => {
      try {
        setTelegramError(null);
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTelegramError((data as any)?.error ?? "telegram_auth_failed");
          return;
        }

        // Сначала закрываем окно (анимация + гарантированное закрытие)
        closeAfterAuth();

        // Затем обновляем состояние пользователя
        if (onSuccessRef.current) {
          onSuccessRef.current();
        } else if (typeof window !== "undefined") {
          window.location.reload();
        }
      } catch (e) {
        console.error("[AuthModal] Telegram auth error:", e);
        setTelegramError("telegram_auth_failed");
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "Vilka_Auth_bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    mount.appendChild(script);

    return () => {
      mount.innerHTML = "";
      telegramBootedRef.current = false;
      try {
        delete (window as any).onTelegramAuth;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step]);

  // таймер на шаге ввода кода
  useEffect(() => {
    if (step !== "code") return;

    setCodeError(false);
    setTimer(60);

    const id = window.setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(id);
  }, [step]);

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // только цифры
    let digits = value.replace(/\D/g, "");

    // убираем ведущую 7, т.к. уже есть +7
    if (digits.startsWith("7")) {
      digits = digits.slice(1);
    }

    if (digits.length > MAX_PHONE_DIGITS) {
      digits = digits.slice(0, MAX_PHONE_DIGITS);
    }

    setPhoneDigits(digits);
  };

  const handleCodeSubmit = async (codeValue: string) => {
    const trimmedCode = codeValue.trim();

    if (!VALID_CODES.includes(trimmedCode)) {
      setCodeError(true);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Auth API error:", res.status, errorData);
        setCodeError(true);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else if (typeof window !== "undefined") {
        window.location.reload();
      }

      closeModal();
    } catch (e) {
      console.error("Auth error:", e);
      setCodeError(true);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);

    const next = [...code];
    next[index] = digit;
    setCode(next);
    setCodeError(false);

    // если ввели цифру и это не последний инпут — фокус на следующий
    if (digit && index < next.length - 1) {
      codeInputsRef.current[index + 1]?.focus();
    }

    // если все 4 позиции заполнены — проверяем код
    const full = next.join("");
    if (full.length === next.length) {
      handleCodeSubmit(full);
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevIndex = index - 1;
      const next = [...code];
      next[prevIndex] = "";
      setCode(next);
      codeInputsRef.current[prevIndex]?.focus();
      e.preventDefault();
    }
  };

  const formatTimer = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* overlay */}
      <div
        className={["auth-overlay absolute inset-0 bg-black/40", closing ? "closing" : ""].join(" ")}
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* panel — размеры/отступы как ProfileDrawer */}
      <div
        className={[
          "auth-modal absolute inset-y-0 right-0 w-full max-w-[520px] p-4 sm:p-5",
          closing ? "closing" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Авторизация"
      >
        <div className="relative h-full overflow-hidden rounded-[32px] bg-white shadow-2xl">
          {/* ВАЖНО: делаем внутренний контейнер relative+h-full и раскладываем absolute слоями */}
          <div className="relative h-full p-6 sm:p-7">
            {/* top bar — absolute, чтобы не толкать центр */}
            <div className="absolute inset-x-6 top-6 flex items-center justify-between sm:inset-x-7 sm:top-7">
              <button
                type="button"
                onClick={() => (step === "phone" ? closeModal() : setStep("phone"))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                aria-label={step === "phone" ? "Назад" : "К вводу телефона"}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === "phone" ? (
              <>
                {/* CENTER — строго по центру модалки */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 sm:inset-x-7">
                  <div className="flex w-full flex-col items-center">
                    <span className="text-sm text-slate-400">Телефон</span>

                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      inputMode="numeric"
                      className="mt-2 w-full border-none bg-transparent text-center text-5xl font-semibold tracking-wide text-slate-900 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (isPhoneComplete) {
                          setStep("code");
                          setTimeout(() => {
                            codeInputsRef.current[0]?.focus();
                          }, 0);
                        }
                      }}
                      className="vilka-btn-primary mt-10 h-14 w-full rounded-full px-6 text-base font-semibold"
                      disabled={!isPhoneComplete}
                    >
                      Получить код
                    </button>
                  </div>
                </div>

                {/* BOTTOM — внизу (не толкает центр) */}
                <div className="absolute inset-x-6 bottom-6 sm:inset-x-7 sm:bottom-7">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs font-semibold text-slate-500">или</div>

                    <div ref={telegramMountRef} className="min-h-[44px]" />

                    {telegramError && (
                      <div className="text-xs font-semibold text-red-600">
                        Не удалось войти через Telegram ({telegramError})
                      </div>
                    )}
                  </div>

                  <p className="mt-6 text-center text-[12px] leading-relaxed text-slate-500">
                    Продолжая авторизацию, вы соглашаетесь с{" "}
                    <span className="cursor-pointer text-slate-700 underline underline-offset-2">
                      политикой конфиденциальности
                    </span>
                    ,{" "}
                    <span className="cursor-pointer text-slate-700 underline underline-offset-2">
                      условиями сервиса
                    </span>{" "}
                    и{" "}
                    <span className="cursor-pointer text-slate-700 underline underline-offset-2">
                      условиями продажи товаров
                    </span>
                    .
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* CENTER — код тоже строго по центру */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 sm:inset-x-7">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-semibold text-slate-900">{phone}</span>
                    <div className="mt-2 text-sm text-slate-500">Код из смс</div>

                    <div className="mt-8 flex gap-3">
                      {code.map((value, index) => (
                        <input
                          key={index}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={value}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(index, e)}
                          ref={(el) => {
                            codeInputsRef.current[index] = el;
                          }}
                          className={[
                            "h-14 w-12 rounded-2xl text-center text-xl font-semibold outline-none",
                            codeError
                              ? "border border-red-300 bg-red-50 text-red-500"
                              : "border border-slate-200 bg-slate-100 text-slate-900",
                          ].join(" ")}
                        />
                      ))}
                    </div>

                    {codeError && <div className="mt-4 text-xs font-semibold text-red-500">Не тот код.</div>}

                    <div className="mt-6 text-xs text-slate-500">
                      Получить новый можно через <span>{formatTimer(timer)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
