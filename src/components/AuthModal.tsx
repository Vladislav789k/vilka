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

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [closing, setClosing] = useState(false);
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

  // сброс при открытии
  useEffect(() => {
    if (isOpen) {
      setStep("phone");
      setPhoneDigits("");
      setCode(["", "", "", ""]);
      setCodeError(false);
      setTimer(60);
      setClosing(false); // сбрасываем статус закрытия
      setTelegramError(null);
      telegramBootedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

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

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);

    const next = [...code];
    next[index] = digit;
    setCode(next);
    setCodeError(false);

    // если ввели цифру и это не последний инпут — фокус на следующий
    if (digit && index < code.length - 1) {
      codeInputsRef.current[index + 1]?.focus();
    }

    // если все 4 позиции заполнены — проверяем код
    const full = next.join("");
    console.log("[AuthModal] Code input:", full, "length:", full.length, "code.length:", code.length);
    if (full.length === code.length) {
      console.log("[AuthModal] Submitting code:", full);
      handleCodeSubmit(full);
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ) => {
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

  const closeModal = () => {
    if (closing) return;
    setClosing(true); // начинаем анимацию закрытия
    window.setTimeout(() => {
      onClose();
    }, 500); // ждём окончания анимации
  };

  const closeAfterAuth = () => {
    // если модалка уже "закрывается", не ждём — просим родителя закрыть сейчас
    if (closing) {
      onClose();
      return;
    }
    closeModal();
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

      const data = await res.json();
      console.log("Auth success:", data);

      // Успешная авторизация
      // Вызываем callback для обновления состояния пользователя
      if (onSuccess) {
        onSuccess();
      } else {
        // Если callback не передан, перезагружаем страницу
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
      closeModal();
    } catch (e) {
      console.error("Auth error:", e);
      setCodeError(true);
    }
  };

  /* ========== JSX ========== */

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/40 px-4">
      <div
        className={`auth-modal relative w-full max-w-md rounded-[32px] bg-white p-6 sm:p-8 shadow-vilka-soft dark:bg-slate-600 dark:shadow-xl ${
          closing ? "closing" : ""
        }`}
        style={{ color: 'inherit' }}
      >
        {/* Верхняя панель */}
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === "phone" ? closeModal() : setStep("phone"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-slate-800 hover:bg-slate-200 dark:bg-slate-500 dark:text-white dark:hover:bg-slate-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-slate-800 hover:bg-slate-200 dark:bg-slate-500 dark:text-white dark:hover:bg-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "phone" ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <span className="text-base font-bold text-black dark:text-white">Телефон</span>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                inputMode="numeric"
                className="w-full border-none bg-transparent text-center text-4xl font-bold tracking-wide text-black outline-none dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="+7"
              />
            </div>

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
              disabled={!isPhoneComplete}
              className="mt-10 flex w-full items-center justify-center rounded-full px-4 py-3.5 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-brand text-white hover:bg-brand-dark dark:bg-brand dark:hover:bg-brand-dark"
            >
              Получить код
            </button>

            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                или
              </div>
              <div ref={telegramMountRef} className="min-h-[44px]" />
              {telegramError && (
                <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Не удалось войти через Telegram ({telegramError})
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-base leading-relaxed text-black dark:text-white font-semibold">
              Продолжая авторизацию, вы соглашаетесь с{" "}
              <span className="cursor-pointer font-bold text-black underline underline-offset-2 hover:text-slate-700 dark:text-white dark:hover:text-slate-300">
                политикой конфиденциальности
              </span>
              ,{" "}
              <span className="cursor-pointer font-bold text-black underline underline-offset-2 hover:text-slate-700 dark:text-white dark:hover:text-slate-300">
                условиями сервиса
              </span>{" "}
              и{" "}
              <span className="cursor-pointer font-bold text-black underline underline-offset-2 hover:text-slate-700 dark:text-white dark:hover:text-slate-300">
                условиями продажи товаров
              </span>
              .
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-6">
              <span className="text-2xl font-bold text-black dark:text-white tracking-tight">
                {phone}
              </span>
              <div className="text-base font-bold text-black dark:text-white">Код из смс</div>

              <div className="flex gap-3">
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
                      "h-14 w-12 rounded-2xl text-center text-xl font-bold outline-none transition-all focus:ring-2 focus:ring-brand focus:ring-offset-2",
                      codeError
                        ? "bg-red-50 text-red-600 border-2 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-500"
                        : "bg-muted text-black border-2 border-slate-300 dark:bg-slate-500 dark:text-white dark:border-slate-400 focus:border-brand dark:focus:border-brand",
                    ].join(" ")}
                  />
                ))}
              </div>

              {codeError && (
                <div className="text-sm font-bold text-red-600 dark:text-red-400">
                  Не тот код.
                </div>
              )}

              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Получить новый можно через{" "}
                <span className="font-bold text-black dark:text-white">{formatTimer(timer)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
