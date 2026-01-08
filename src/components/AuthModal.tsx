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
    }
  }, [isOpen]);

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
        className={`auth-modal relative w-full max-w-md rounded-[32px] bg-white p-6 sm:p-8 shadow-vilka-soft ${
          closing ? "closing" : ""
        }`}
      >
        {/* Верхняя панель */}
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === "phone" ? closeModal() : setStep("phone"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "phone" ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <span className="text-sm text-slate-500">Телефон</span>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                inputMode="numeric"
                className="w-full border-none bg-transparent text-center text-3xl font-semibold tracking-wide text-slate-900 outline-none"
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
              className="vilka-btn-primary mt-10 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold"
            >
              Получить код
            </button>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
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
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-6">
              <span className="text-base font-semibold text-slate-900">
                {phone}
              </span>
              <div className="text-sm text-slate-500">Код из смс</div>

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
                      "h-12 w-10 rounded-2xl text-center text-lg font-semibold outline-none",
                      codeError
                        ? "bg-red-50 text-red-500 border border-red-300"
                        : "bg-slate-100 text-slate-900 border border-slate-200",
                    ].join(" ")}
                  />
                ))}
              </div>

              {codeError && (
                <div className="text-xs font-semibold text-red-500">
                  Не тот код.
                </div>
              )}

              <div className="text-xs text-slate-500">
                Получить новый можно через{" "}
                <span>{formatTimer(timer)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
