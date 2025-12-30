"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Trash2, Upload, Image as ImageIcon, X } from "lucide-react";

type BusinessItem = {
  id: number;
  name: string;
  composition: string | null;
  price: number;
  discount_percent: number | null;
  image_url: string | null;
  ref_category_id: number;
  is_brand_anonymous: boolean;
  is_active: boolean | null; // может прийти null/undefined из старых данных
  stock_qty: number;
};

type Category = {
  id: number;
  name: string;
  code: string;
};

export default function BusinessPage() {
  const [step, setStep] = useState<"login" | "catalog">("login");

  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

  const [items, setItems] = useState<BusinessItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // форма добавления
  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState("100");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandAnonymous, setIsBrandAnonymous] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const stockEditPrevRef = useRef<Record<number, number>>({});

  // preview для выбранной картинки
  useEffect(() => {
    if (!imageFile) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  // === Восстановление авторизации из localStorage ===
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("vilka_business_auth");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        restaurantId?: number;
        restaurantName?: string | null;
      };

      if (parsed.restaurantId) {
        setRestaurantId(parsed.restaurantId);
        setRestaurantName(parsed.restaurantName ?? null);
        setStep("catalog");
      }
    } catch {
      // broken json — игнорируем
    }
  }, []);

  // === Загрузка категорий из ref_dish_categories (уровень 3) ===
  useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      setCategoriesError(null);
      try {
        const res = await fetch("/api/business/categories");
        if (!res.ok) {
          let errText = "Не удалось загрузить категории";
          try {
            const data = await res.json();
            if ((data as any).error) errText = (data as any).error;
          } catch {
            /* ignore */
          }
          setCategoriesError(errText);
          return;
        }
        const data: Category[] = await res.json();
        setCategories(data);
      } catch (e) {
        console.error(e);
        setCategoriesError("Ошибка загрузки категорий");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // закрыть дропдаун категорий при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!categoryDropdownRef.current) return;
      if (!categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // === Загрузка карточек блюд после логина ===
  useEffect(() => {
    if (!restaurantId) return;

    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        const res = await fetch(
          `/api/business/menu-items?restaurantId=${restaurantId}`
        );

        if (!res.ok) {
          console.error(
            "Ошибка при загрузке /api/business/menu-items:",
            res.status
          );
          return;
        }

        const data: BusinessItem[] = await res.json();
        setItems(data);
      } catch (e) {
        console.error("Ошибка сети при загрузке блюд:", e);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [restaurantId]);

  // отфильтрованные категории по введённому тексту
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryQuery.toLowerCase())
  );

  // === Логин по коду заведения ===
  const handleLogin = async () => {
    setLoginError(null);

    try {
      const res = await fetch("/api/business/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: loginCode }),
      });

      if (!res.ok) {
        let err = "Ошибка входа";
        try {
          const data = await res.json();
          if ((data as any).error) err = (data as any).error;
        } catch {
          /* ignore */
        }
        setLoginError(err);
        return;
      }

      const data = await res.json();

      setRestaurantId(data.restaurantId);
      setRestaurantName(data.restaurantName);
      setStep("catalog");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "vilka_business_auth",
          JSON.stringify({
            restaurantId: data.restaurantId,
            restaurantName: data.restaurantName ?? null,
          })
        );
      }
    } catch (e) {
      console.error(e);
      setLoginError("Ошибка сервера");
    }
  };

  // === Создание блюда ===
  const handleCreateItem = async () => {
    setFormError(null);

    if (!restaurantId) {
      setFormError("Сначала войдите по коду бизнеса");
      return;
    }

    if (!name.trim() || !price || !categoryId) {
      setFormError("Название, цена и категория обязательны");
      return;
    }

    if (stockQty && (!Number.isFinite(Number(stockQty)) || Number(stockQty) < 0)) {
      setFormError("Остаток должен быть числом >= 0");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/business/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          composition: composition.trim() || null,
          price: Number(price),
          discountPercent: discountPercent ? Number(discountPercent) : null,
          stockQty: stockQty ? Number(stockQty) : null,
          refCategoryId: Number(categoryId),
          isBrandAnonymous,
        }),
      });

      if (!res.ok) {
        let err = "Не удалось сохранить блюдо";
        try {
          const data = await res.json();
          if ((data as any).error) err = (data as any).error;
        } catch {
          /* ignore */
        }
        setFormError(err);
        return;
      }

      const data = await res.json();
      const newId = (data as any).id as number;

      // если выбрали картинку — загружаем её отдельно в MinIO и получаем URL
      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        try {
          const fd = new FormData();
          fd.set("file", imageFile);
          const imgRes = await fetch(
            `/api/business/menu-items/${newId}/image?restaurantId=${restaurantId}`,
            { method: "POST", body: fd }
          );
          if (!imgRes.ok) {
            let err = "Не удалось загрузить изображение";
            try {
              const errData = await imgRes.json();
              if ((errData as any).error) err = (errData as any).error;
            } catch {
              /* ignore */
            }
            // блюдо создано, но картинка не загрузилась
            console.error(err);
          } else {
            const imgData = await imgRes.json();
            uploadedImageUrl = ((imgData as any).imageUrl as string) ?? null;
          }
        } catch (e) {
          console.error("Ошибка сети при загрузке изображения:", e);
        }
      }

      // очистка формы
      setName("");
      setComposition("");
      setPrice("");
      setDiscountPercent("");
      setImageFile(null);
      setStockQty("100");
      setCategoryId("");
      setCategoryQuery("");
      setIsBrandAnonymous(false);

      // локально добавляем блюдо в начало списка
      setItems((prev) => [
        {
          id: newId,
          name,
          composition: composition || null,
          price: Number(price),
          discount_percent: discountPercent ? Number(discountPercent) : null,
          image_url: uploadedImageUrl,
          ref_category_id: Number(categoryId),
          is_brand_anonymous: isBrandAnonymous,
          is_active: true,
          stock_qty: stockQty ? Number(stockQty) : 100,
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
      setFormError("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  // === Удаление блюда ===
  const handleDeleteItem = async (id: number) => {
    if (!restaurantId) return;

    if (!confirm("Удалить блюдо?")) return;

    try {
      const res = await fetch(
        `/api/business/menu-items/${id}?restaurantId=${restaurantId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        console.error("Ошибка при DELETE menu-item:", res.status);
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // === Вкл/выкл в каталоге ===
  const handleToggleActive = async (
    id: number,
    currentIsActive: boolean | null
  ) => {
    if (!restaurantId) return;
    const prev = currentIsActive ?? true;
    const next = !prev;

    // оптимистично меняем в стейте
    setItems((prevItems) =>
      prevItems.map((it) =>
        it.id === id ? { ...it, is_active: next } : it
      )
    );

    try {
      const res = await fetch(
        `/api/business/menu-items/${id}?restaurantId=${restaurantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        }
      );

      if (!res.ok) {
        console.error("Ошибка при PATCH isActive:", res.status);
        // откат
        setItems((prevItems) =>
          prevItems.map((it) =>
            it.id === id ? { ...it, is_active: prev } : it
          )
        );
      }
    } catch (e) {
      console.error("Сетевая ошибка при PATCH isActive:", e);
      setItems((prevItems) =>
        prevItems.map((it) =>
          it.id === id ? { ...it, is_active: prev } : it
        )
      );
    }
  };

  // === Вкл/выкл анонимности бренда ===
  const handleToggleBrandAnonymous = async (
    id: number,
    currentIsAnon: boolean
  ) => {
    if (!restaurantId) return;
    const prev = currentIsAnon;
    const next = !prev;

    // оптимистично меняем
    setItems((prevItems) =>
      prevItems.map((it) =>
        it.id === id ? { ...it, is_brand_anonymous: next } : it
      )
    );

    try {
      const res = await fetch(
        `/api/business/menu-items/${id}?restaurantId=${restaurantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isBrandAnonymous: next }),
        }
      );

      if (!res.ok) {
        console.error("Ошибка при PATCH isBrandAnonymous:", res.status);
        // откат
        setItems((prevItems) =>
          prevItems.map((it) =>
            it.id === id ? { ...it, is_brand_anonymous: prev } : it
          )
        );
      }
    } catch (e) {
      console.error("Сетевая ошибка при PATCH isBrandAnonymous:", e);
      setItems((prevItems) =>
        prevItems.map((it) =>
          it.id === id ? { ...it, is_brand_anonymous: prev } : it
        )
      );
    }
  };

  // === Обновление остатка ===
  const handleUpdateStock = async (id: number, nextStockQty: number, prevStockQty: number) => {
    if (!restaurantId) return;
    if (!Number.isFinite(nextStockQty) || nextStockQty < 0) return;

    // оптимистично уже обновили в стейте; если сервер не принял — откатываем
    try {
      const res = await fetch(
        `/api/business/menu-items/${id}?restaurantId=${restaurantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockQty: Math.floor(nextStockQty) }),
        }
      );

      if (!res.ok) {
        console.error("Ошибка при PATCH stockQty:", res.status);
        setItems((prevItems) =>
          prevItems.map((it) =>
            it.id === id ? { ...it, stock_qty: prevStockQty } : it
          )
        );
      }
    } catch (e) {
      console.error("Сетевая ошибка при PATCH stockQty:", e);
      setItems((prevItems) =>
        prevItems.map((it) =>
          it.id === id ? { ...it, stock_qty: prevStockQty } : it
        )
      );
    }
  };

  const getCategoryNameById = (id: number) => {
    const c = categories.find((cat) => cat.id === id);
    return c?.name ?? "Без категории";
  };

  // === UI ===
  return (
    <main className="min-h-screen bg-surface-soft">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
              <span className="text-lg font-bold text-brand-dark">V</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-slate-900">
                Вилка для бизнеса
              </span>
              <span className="text-xs text-slate-600">
                Кабинет партнёра: добавляйте блюда в каталог
              </span>
            </div>
          </Link>

          {restaurantName && (
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="text-right">
                <div className="font-semibold text-slate-900">
                  {restaurantName}
                </div>
                <div>Подключён по коду</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("vilka_business_auth");
                  }
                  setRestaurantId(null);
                  setRestaurantName(null);
                  setStep("login");
                  setItems([]);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {/* БЛОК ВХОДА */}
        {step === "login" && (
          <section className="rounded-3xl bg-white p-5 shadow-vilka-soft">
            <h1 className="text-lg font-semibold text-slate-900">
              Вход для партнёров
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Введите код, который мы выдали вашему заведению. После входа вы
              сможете добавлять блюда в каталог.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                placeholder="Код заведения"
                className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={handleLogin}
                className="vilka-btn-primary rounded-2xl px-4 py-2 text-sm font-semibold"
              >
                Войти
              </button>
            </div>

            {loginError && (
              <p className="mt-2 text-sm text-red-500">{loginError}</p>
            )}
          </section>
        )}

        {/* БЛОК КАТАЛОГА */}
        {step === "catalog" && (
          <>
            {/* форма добавления */}
            <section className="rounded-3xl bg-white p-5 shadow-vilka-soft">
              <h2 className="text-base font-semibold text-slate-900">
                Добавить блюдо в каталог
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <label className="text-xs text-slate-600">
                    Название блюда
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="text-xs text-slate-600">
                    Состав / описание
                    <textarea
                      value={composition}
                      onChange={(e) => setComposition(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="text-xs text-slate-600">
                    Категория
                    <div
                      ref={categoryDropdownRef}
                      className="relative mt-1"
                    >
                      <input
                        type="text"
                        value={categoryQuery}
                        onChange={(e) => {
                          setCategoryQuery(e.target.value);
                          setCategoryId("");
                          setIsCategoryDropdownOpen(true);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        placeholder={
                          isLoadingCategories
                            ? "Загружаем категории..."
                            : "Начните вводить название…"
                        }
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                      />

                      {isCategoryDropdownOpen && (
                        <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-2xl border border-slate-200 bg-white text-sm shadow-vilka-soft">
                          {filteredCategories.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500">
                              Ничего не найдено
                            </div>
                          ) : (
                            filteredCategories.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setCategoryId(c.id);
                                  setCategoryQuery(c.name);
                                  setIsCategoryDropdownOpen(false);
                                }}
                                className={[
                                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                                  c.id === categoryId
                                    ? "bg-emerald-50 text-slate-900"
                                    : "hover:bg-surface-soft",
                                ].join(" ")}
                              >
                                <span>{c.name}</span>
                                <span className="text-[11px] text-slate-400">
                                  {c.code}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {categoriesError && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {categoriesError}
                      </p>
                    )}
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={isBrandAnonymous}
                      onChange={(e) => setIsBrandAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    Показать блюдо как анонимное (без бренда заведения)
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs text-slate-600">
                    Цена, ₽
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="text-xs text-slate-600">
                    Скидка, %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="text-xs text-slate-600">
                    Остаток, шт
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <div className="text-xs text-slate-600">
                    <div className="mb-1">Фото блюда</div>
                    {!imagePreviewUrl ? (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-surface-soft px-4 py-6 transition-colors hover:border-brand hover:bg-slate-50">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-vilka-soft">
                          <Upload className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-slate-700">
                            Нажмите для загрузки
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            или перетащите изображение
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-surface-soft">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imagePreviewUrl}
                              alt="Предпросмотр"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs text-slate-700">
                              <ImageIcon className="h-4 w-4 text-slate-500" />
                              <span className="truncate font-medium">
                                {imageFile?.name ?? "Изображение"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setImageFile(null);
                                setImagePreviewUrl(null);
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                              Убрать фото
                            </button>
                          </div>
                        </div>
                        <label className="absolute bottom-3 right-3">
                          <span className="vilka-btn-primary flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold">
                            <Upload className="h-3 w-3" />
                            Заменить
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCreateItem}
                      disabled={isSaving}
                      className="vilka-btn-primary w-full rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {isSaving ? "Сохраняем..." : "Добавить блюдо"}
                    </button>
                    {formError && (
                      <p className="mt-2 text-sm text-red-500">{formError}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* список блюд */}
            <section className="rounded-3xl bg-white p-5 shadow-vilka-soft">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Ваши блюда в каталоге
                </h2>
                {isLoadingItems && (
                  <span className="text-xs text-slate-500">Обновляем…</span>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Пока нет ни одного блюда. Добавьте первое через форму выше.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((item) => {
                    const finalPrice =
                      item.discount_percent != null
                        ? Math.round(
                            item.price * (1 - item.discount_percent / 100)
                          )
                        : item.price;

                    const active = item.is_active ?? true;

                    return (
                      <article
                        key={item.id}
                        className="flex gap-3 rounded-3xl border border-surface-soft bg-surface-soft p-3"
                      >
                        {item.image_url && (
                          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                                {item.composition}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {getCategoryNameById(item.ref_category_id)}
                              </p>
                              {item.is_brand_anonymous && (
                                <span className="mt-1 inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Анонимное блюдо
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="rounded-full bg-white p-1 text-slate-500 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-1 flex items-end justify-between gap-2">
                            <div className="flex items-end gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {finalPrice} ₽
                              </span>
                              {item.discount_percent != null && (
                                <span className="text-xs text-slate-500 line-through">
                                  {item.price} ₽
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Остаток */}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-600">
                              Остаток
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={Number.isFinite(item.stock_qty) ? item.stock_qty : 0}
                              onFocus={() => {
                                stockEditPrevRef.current[item.id] = Number.isFinite(item.stock_qty)
                                  ? item.stock_qty
                                  : 0;
                              }}
                              onChange={(e) => {
                                const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                setItems((prevItems) =>
                                  prevItems.map((it) =>
                                    it.id === item.id ? { ...it, stock_qty: next } : it
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                const prev = stockEditPrevRef.current[item.id];
                                if (typeof prev === "number" && next !== prev) {
                                  handleUpdateStock(item.id, next, prev);
                                }
                              }}
                              className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-right text-xs outline-none focus:border-brand"
                            />
                          </div>

                          {/* Переключатели */}
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {/* В каталоге / выключено */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleActive(item.id, item.is_active)
                              }
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1",
                                active
                                  ? "border-emerald-300 bg-emerald-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-500",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "h-3 w-3 rounded-full border",
                                  active
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-slate-300 bg-white",
                                ].join(" ")}
                              />
                              <span>
                                {active ? "В каталоге" : "Выключено"}
                              </span>
                            </button>

                            {/* Анонимность */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleBrandAnonymous(
                                  item.id,
                                  item.is_brand_anonymous
                                )
                              }
                              className={[
                                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1",
                                item.is_brand_anonymous
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "h-3 w-3 rounded-full border",
                                  item.is_brand_anonymous
                                    ? "border-white bg-white/90"
                                    : "border-slate-300 bg-white",
                                ].join(" ")}
                              />
                              <span>
                                {item.is_brand_anonymous
                                  ? "Анонимно"
                                  : "С брендом"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
