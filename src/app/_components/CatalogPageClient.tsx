"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { ShoppingBag, MapPin, User, Search, Clock, ChevronRight, MessageCircle } from "lucide-react";

import AuthModal from "@/components/AuthModal";
import AddressModal from "@/components/AddressModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import AnonymousOfferCard from "@/components/AnonymousOfferCard";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import { MenuOptionButton } from "@/components/MenuOptionButton";
import { QuantityControls } from "@/components/QuantityControls";
import { Heart } from "lucide-react";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import { buildCatalogIndexes } from "@/modules/catalog/indexes";
import { ensureValidSelection, type Selection } from "@/modules/catalog/selection";
import type { BaseItemId, CatalogData, CategoryId, SubcategoryId } from "@/modules/catalog/types";

type CatalogPageClientProps = {
  catalog: CatalogData;
};

type CatalogIndexes = ReturnType<typeof buildCatalogIndexes>;

function getInitialSelection(catalog: CatalogData): Selection {
  const firstCategory = catalog.categories[0]?.id ?? null;
  const firstSub = firstCategory
    ? catalog.subcategories.find((s) => s.categoryId === firstCategory) ?? null
    : null;
  const firstItem = firstSub && catalog.baseItems.find((i) => i.subcategoryId === firstSub.id);

  return {
    categoryId: firstCategory,
    subcategoryId: firstSub?.id ?? null,
    itemId: firstItem?.id ?? null,
  };
}

function CategoryEmoji({ code }: { code: string }) {
  const emoji = code.startsWith("bakery")
    ? "🥐"
    : code.startsWith("breakfasts")
    ? "🍳"
    : code.startsWith("snacks")
    ? "🥨"
    : code.startsWith("salads")
    ? "🥗"
    : code.startsWith("soups")
    ? "🥣"
    : code.startsWith("pizza")
    ? "🍕"
    : code.startsWith("burgers")
    ? "🍔"
    : code.startsWith("hot")
    ? "🍽️"
    : code.startsWith("pasta")
    ? "🍝"
    : code.startsWith("desserts")
    ? "🍰"
    : code.startsWith("drinks")
    ? "🥤"
    : code.startsWith("combos")
    ? "🧺"
    : "🍴";
  return <span>{emoji}</span>;
}

function CatalogUI({
  catalog,
  indexes,
}: CatalogPageClientProps & { indexes: CatalogIndexes }) {
  const { quantities, entries, totals, offerStocks, add, remove } = useCart();

  // #region agent log
  useEffect(() => {
    const logViewport = () => {
      const width = window.innerWidth;
      const sidebarEl = document.querySelector('aside[class*="hidden"]');
      const computedWidth = sidebarEl ? window.getComputedStyle(sidebarEl).width : "unknown";
      const gridEl = document.querySelector('div[class*="grid-cols"]');
      const gridTemplate = gridEl ? window.getComputedStyle(gridEl).gridTemplateColumns : "unknown";
      fetch("http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "CatalogPageClient.tsx:69",
          message: "Viewport and layout check",
          data: {
            viewportWidth: width,
            sidebarWidth: computedWidth,
            gridTemplate,
            breakpoint: width >= 1280 ? "xl" : width >= 1024 ? "lg" : width >= 768 ? "md" : "sm",
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "A",
        }),
      }).catch(() => {});
    };
    logViewport();
    window.addEventListener("resize", logViewport);
    return () => window.removeEventListener("resize", logViewport);
  }, []);
  // #endregion

  const [searchQuery, setSearchQuery] = useState("");
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState<string>("asap");
  const [lineNotes, setLineNotes] = useState<Record<string, { comment: string; allowReplacement: boolean }>>(
    {}
  );
  const [lineFavorites, setLineFavorites] = useState<Record<string, boolean>>({});
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [currentAddressLabel, setCurrentAddressLabel] = useState<string>("Указать адрес доставки");
  const [user, setUser] = useState<{ id: number; phone: string; role: string } | null>(null);
  const [pendingAddOfferId, setPendingAddOfferId] = useState<number | null>(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  // Важно: desktop и mobile хедеры одновременно в DOM (только CSS скрывает),
  // поэтому один ref на два элемента ломает "click outside" (закрывает меню до клика по пунктам).
  const profileDropdownRefDesktop = useRef<HTMLDivElement | null>(null);
  const profileDropdownRefMobile = useRef<HTMLDivElement | null>(null);

  // анимация "надавливания" для карточек (через capture, чтобы работало даже если внутри stopPropagation)
  // Замените существующее состояние pressedCardId на:
  const [pressedCardId, setPressedCardId] = useState<string | number | null>(null);
  const [pressedCardState, setPressedCardState] = useState<'down' | 'up' | null>(null);

  const initial = useMemo(() => getInitialSelection(catalog), [catalog]);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | null>(initial.categoryId);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<SubcategoryId | null>(initial.subcategoryId);
  const [activeItemId, setActiveItemId] = useState<BaseItemId | null>(initial.itemId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<CategoryId[]>(
    initial.categoryId ? [initial.categoryId] : []
  );

  const { categories, subcategories, baseItems } = catalog;

  useEffect(() => {
    const next = ensureValidSelection(
      { categoryId: activeCategoryId, subcategoryId: activeSubcategoryId, itemId: activeItemId },
      indexes
    );
    if (next.subcategoryId !== activeSubcategoryId) setActiveSubcategoryId(next.subcategoryId);
    if (next.itemId !== activeItemId) setActiveItemId(next.itemId);
  }, [activeCategoryId, activeSubcategoryId, activeItemId, indexes]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    if (catalog.baseItems.length === 0) return;

    const matchedItem =
      catalog.baseItems.find((i) => i.name.toLowerCase().includes(q)) ||
      catalog.baseItems.find((i) => (i.description ?? "").toLowerCase().includes(q));

    if (!matchedItem) return;

    setActiveCategoryId(matchedItem.categoryId);
    setActiveSubcategoryId(matchedItem.subcategoryId);
    setActiveItemId(matchedItem.id);
    setExpandedCategoryIds((prev) =>
      prev.includes(matchedItem.categoryId) ? prev : [...prev, matchedItem.categoryId]
    );
  }, [searchQuery, catalog]);

  const toggleCategoryExpanded = (categoryId: CategoryId) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    setActiveCategoryId(categoryId);
    // Reset deeper levels: user should explicitly choose subcategory (2nd) and item (3rd).
    setActiveSubcategoryId(null);
    setActiveItemId(null);
    toggleCategoryExpanded(categoryId);
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId) => {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (!sub) return;

    setActiveCategoryId(sub.categoryId);
    setActiveSubcategoryId(sub.id);
    // 3rd level should be chosen by the user in the main content area.
    setActiveItemId(null);
    setExpandedCategoryIds((prev) => (prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]));
  };

  const handleItemClick = (itemId: BaseItemId) => {
    const item = baseItems.find((i) => i.id === itemId);
    if (!item) return;

    setActiveCategoryId(item.categoryId);
    setActiveSubcategoryId(item.subcategoryId);
    setActiveItemId(item.id);
    setExpandedCategoryIds((prev) => (prev.includes(item.categoryId) ? prev : [...prev, item.categoryId]));
  };

  const handleAddToCart = (offerId: number) => {
    if (!user) {
      setPendingAddOfferId(offerId);
      setIsAuthOpen(true);
      return;
    }
    add(offerId);
  };

  const subcategoriesForCategory = useMemo(
    () => (activeCategoryId ? indexes.subcategoriesByCategory.get(activeCategoryId) ?? [] : []),
    [activeCategoryId, indexes]
  );

  const itemsForSubcategory = useMemo(
    () => (activeSubcategoryId ? indexes.itemsBySubcategory.get(activeSubcategoryId) ?? [] : []),
    [activeSubcategoryId, indexes]
  );

  const offersForItem = useMemo(
    () => (activeItemId ? indexes.offersByBaseItem.get(activeItemId) ?? [] : []),
    [activeItemId, indexes]
  );

  const anonOffer = offersForItem.find((o) => o.isAnonymous);
  const brandedOffers = offersForItem.filter((o) => !o.isAnonymous);

  const cartButtonLabel = totals.totalPrice > 0 ? `${totals.totalPrice} ₽` : "0 ₽";
  const cartCountLabel = totals.totalCount > 0 ? `${totals.totalCount}` : "0";

  const currentCategory = categories.find((c) => c.id === activeCategoryId);
  const currentSubcategory = subcategories.find((s) => s.id === activeSubcategoryId);
  const currentItem = baseItems.find((i) => i.id === activeItemId);

  const handleCategoryBreadcrumbClick = (categoryId: CategoryId) => {
    setActiveCategoryId(categoryId);
    setExpandedCategoryIds((prev) => (prev.includes(categoryId) ? prev : [...prev, categoryId]));

    // We don't render 2nd level selector in the main content anymore, so pick a subcategory to drive 3rd level list.
    const subs = indexes.subcategoriesByCategory.get(categoryId) ?? [];
    const nextSub = subs[0]?.id ?? null;
    setActiveSubcategoryId(nextSub);
    setActiveItemId(null);
  };

  const handleSubcategoryBreadcrumbClick = (subcategoryId: SubcategoryId) => {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (!sub) return;
    setActiveCategoryId(sub.categoryId);
    setExpandedCategoryIds((prev) => (prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]));
    setActiveSubcategoryId(sub.id);
    setActiveItemId(null);
  };

  const breadcrumbLinkClasses =
    "cursor-pointer text-slate-500 hover:text-slate-800 hover:underline underline-offset-4";
  const breadcrumbActiveClasses = "font-medium text-slate-800";

  const renderOffersBlock = (baseItem: (typeof baseItems)[number], offers: typeof offersForItem) => {
    const anon = offers.find((o) => o.isAnonymous);
    const branded = offers.filter((o) => !o.isAnonymous);

    return (
      <>
        {/* Секция анонимных предложений */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Анонимные предложения</span>
            <span className="text-[11px] text-slate-500">Подберём самый дешёвый и ближайший вариант</span>
          </div>

          {anon ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div
                className={[
                  "transform-gpu cursor-pointer select-none transition-transform duration-100 ease-out hover:-translate-y-0.5",
                  "[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95",
                  pressedCardId === anon.id ? "scale-95" : "",
                ].join(" ")}
                onPointerDownCapture={() => setPressedCardId(anon.id)}
                onPointerUpCapture={() => setPressedCardId((prev) => (prev === anon.id ? null : prev))}
                onPointerCancelCapture={() => setPressedCardId((prev) => (prev === anon.id ? null : prev))}
                onPointerLeave={() => setPressedCardId((prev) => (prev === anon.id ? null : prev))}
              >
                <AnonymousOfferCard
                  name={anon.menuItemName}
                  price={anon.price}
                  oldPrice={anon.oldPrice}
                  tag={anon.tag}
                  subtitle={baseItem.description}
                  imageUrl={anon.imageUrl ?? undefined}
                  quantity={quantities[anon.id] ?? 0}
                  isSoldOut={((offerStocks[anon.id] ?? anon.stock) ?? 0) <= 0}
                  onAdd={() => handleAddToCart(anon.id)}
                  onRemove={() => remove(anon.id)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
              Для этой позиции пока нет анонимных предложений.
            </div>
          )}
        </div>

        {/* Секция брендовых предложений */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Из заведений рядом</span>
            <span className="text-[11px] text-slate-500">Заведения, которые показывают свой бренд</span>
          </div>

          {branded.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
              Пока нет брендированных предложений для этой позиции.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branded.map((offer) => {
                const isPressed = pressedCardId === offer.id;
                return (
                  <div
                    key={offer.id}
                    className={[
                      "transform-gpu cursor-pointer select-none transition-transform duration-100 ease-out hover:-translate-y-0.5",
                      "[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95",
                      isPressed ? "scale-95" : "",
                    ].join(" ")}
                    onPointerDownCapture={() => setPressedCardId(offer.id)}
                    onPointerUpCapture={() => setPressedCardId((prev) => (prev === offer.id ? null : prev))}
                    onPointerCancelCapture={() => setPressedCardId((prev) => (prev === offer.id ? null : prev))}
                    onPointerLeave={() => setPressedCardId((prev) => (prev === offer.id ? null : prev))}
                  >
                    <BrandedOfferCard
                      itemName={offer.menuItemName}
                      brand={offer.brand}
                      price={offer.price}
                      oldPrice={offer.oldPrice}
                      tag={offer.tag}
                      subtitle={baseItem.description}
                      imageUrl={offer.imageUrl ?? undefined}
                      quantity={quantities[offer.id] ?? 0}
                      isSoldOut={((offerStocks[offer.id] ?? offer.stock) ?? 0) <= 0}
                      onAdd={() => handleAddToCart(offer.id)}
                      onRemove={() => remove(offer.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  // Загружаем информацию о пользователе
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };
    loadUser();
  }, []);

  // Закрываем выпадающее меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const inDesktop =
        profileDropdownRefDesktop.current ? profileDropdownRefDesktop.current.contains(target) : false;
      const inMobile =
        profileDropdownRefMobile.current ? profileDropdownRefMobile.current.contains(target) : false;

      if (!inDesktop && !inMobile) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isProfileDropdownOpen) {
      // Важно: используем "click", а не "mousedown", иначе меню может закрыться
      // на mousedown и "Выйти" не успевает обработать клик/переход.
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isProfileDropdownOpen]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-surface-soft">
      <header className="shrink-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="hidden md:block">
          <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-3">
              <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                  <span className="text-lg font-bold text-brand-dark">V</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-semibold text-slate-900">Вилка</span>
                  <span className="text-xs text-slate-600">Еда из ресторанов и пекарен</span>
                </div>
              </Link>

              <div className="hidden flex-1 items-center md:flex">
                <div className="flex w-full items-center gap-3 rounded-full bg-surface-soft px-4 py-2 shadow-vilka-soft">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Найти ресторан или блюдо..."
                    value={searchQuery}
                    onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Чат‑бот</span>
                  </button>
                )}
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAddressOpen(true)}
                    className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="max-w-[220px] truncate">{currentAddressLabel}</span>
                  </button>
                )}

                {user ? (
                  <div className="relative hidden md:block" ref={profileDropdownRefDesktop}>
                    <button
                      type="button"
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Профиль</span>
                      <svg className={`h-3 w-3 transition-transform ${isProfileDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white shadow-lg">
                        <div className="p-2">
                          <div className="px-3 py-2 text-xs text-slate-500">
                            {user.phone}
                          </div>
                          <a
                            href="/api/auth/logout"
                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                              // Фоллбек: гарантируем навигацию даже если React/оверлеи вмешаются
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.assign("/api/auth/logout");
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Выйти</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true)}
                    className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Войти</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMiniCartOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>
                      {cartCountLabel} • {cartButtonLabel}
                    </span>
                  </button>

                  {isMiniCartOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                        <span>Корзина</span>
                        <button
                          type="button"
                          className="text-xs text-slate-500 underline"
                          onClick={() => setIsMiniCartOpen(false)}
                        >
                          Закрыть
                        </button>
                      </div>

                      <div className="mt-2 max-h-60 space-y-2 overflow-auto">
                        {entries.length === 0 ? (
                          <div className="text-xs text-slate-500">В корзине пока пусто</div>
                        ) : (
                          entries.map(({ offer, quantity }) => {
                            const isSoldOut =
                              (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;
                            return (
                            <div
                              key={offer.id}
                              className="flex items-center justify-between rounded-xl bg-surface-soft px-2 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-1 text-sm font-semibold text-slate-900">
                                  {offer.menuItemName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {offer.price} ₽ × {quantity}
                                </div>
                              </div>

                              {/* Анимация нажатия на +/- */}
                              <div className="[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95">
                                <QuantityControls
                                  quantity={quantity}
                                      onAdd={() => handleAddToCart(offer.id)}
                                  onRemove={() => remove(offer.id)}
                                  canAdd={!isSoldOut}
                                  size="sm"
                                />
                              </div>
                            </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm font-semibold text-slate-900">
                        <span>Итого</span>
                        <span>{cartButtonLabel}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 bg-white px-4 pt-3 pb-2">
            <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                <span className="text-base font-bold text-brand-dark">V</span>
              </div>
            </Link>

            {user && (
              <button
                type="button"
                onClick={() => setIsAddressOpen(true)}
                className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{currentAddressLabel}</span>
              </button>
            )}

            {user ? (
              <div className="relative" ref={profileDropdownRefMobile}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                >
                  <User className="h-4 w-4" />
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs text-slate-500">
                        {user.phone}
                      </div>
                      <a
                        href="/api/auth/logout"
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.assign("/api/auth/logout");
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Выйти</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
              >
                <User className="h-4 w-4" />
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setIsAssistantOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                title="Чат‑бот"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}

            <button className="flex h-8 items-center justify-center rounded-full bg-brand px-3 text-[11px] font-semibold text-white shadow-md shadow-brand/30 hover:bg-brand-dark">
              {cartButtonLabel}
            </button>
          </div>

          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 pb-2">
              <div className="flex w-full items-center gap-3 rounded-full bg-surface-soft px-4 py-2 shadow-vilka-soft">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Найти ресторан или блюдо..."
                  value={searchQuery}
                  onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 pt-4 md:pt-6">
        <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          {/* #region agent log */}
          <aside
            ref={(el: HTMLElement | null) => {
              if (el) {
                const width = window.getComputedStyle(el).width;
                const display = window.getComputedStyle(el).display;
                const firstBtn = el.querySelector("button");
                const btnTextVisible = firstBtn
                  ? window.getComputedStyle(firstBtn.querySelector('span[class*="hidden"]') as Element).display !==
                    "none"
                  : false;
                fetch("http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "CatalogPageClient.tsx:399",
                    message: "Sidebar render check",
                    data: {
                      sidebarWidth: width,
                      display,
                      textVisible: btnTextVisible,
                      viewportWidth: window.innerWidth,
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "run1",
                    hypothesisId: "A",
                  }),
                }).catch(() => {});
              }
            }}
            className="hidden h-full w-full overflow-y-auto rounded-3xl bg-white shadow-vilka-soft md:block md:w-auto md:border md:border-slate-100"
          >
            {/* #endregion */}
            <div className="rounded-3xl bg-white p-2 md:p-3">
              <h2 className="hidden px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:block">
                Категории
              </h2>

              <nav className="flex flex-col gap-1">
                {categories.map((cat) => {
                  const isCatActive = activeCategoryId === cat.id;
                  const isExpanded = expandedCategoryIds.includes(cat.id);

                  const subsForCat = subcategories.filter((s) => s.categoryId === cat.id);

                  return (
                    <div key={cat.id} className="mb-0.5">
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(cat.id)}
                        title={cat.name}
                        onMouseEnter={(e: { currentTarget: HTMLElement }) => {
                          // #region agent log
                          const el = e.currentTarget;
                          const tooltipEl = window.getComputedStyle(el, "::after");
                          const tooltipOpacity = tooltipEl.opacity;
                          const viewportWidth = window.innerWidth;
                          fetch("http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              location: "CatalogPageClient.tsx:416",
                              message: "Tooltip hover check",
                              data: {
                                categoryName: cat.name,
                                viewportWidth,
                                tooltipOpacity,
                                hasTooltipClass: el.classList.contains("tooltip-icon-only"),
                              },
                              timestamp: Date.now(),
                              sessionId: "debug-session",
                              runId: "run1",
                              hypothesisId: "B",
                            }),
                          }).catch(() => {});
                          // #endregion
                        }}
                        className={[
                          "group flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition",
                          "md:justify-center lg:justify-between",
                          "md:tooltip-icon-only",
                          isCatActive
                            ? "bg-white text-slate-900 font-semibold"
                            : "bg-white text-slate-800 hover:bg-surface-soft",
                        ].join(" ")}
                      >
                        <span
                          ref={(el: HTMLElement | null) => {
                            // #region agent log
                            if (el) {
                              const justifyContent = window.getComputedStyle(el).justifyContent;
                              const viewportWidth = window.innerWidth;
                              fetch("http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  location: "CatalogPageClient.tsx:429",
                                  message: "Icon container alignment check",
                                  data: {
                                    categoryName: cat.name,
                                    justifyContent,
                                    viewportWidth,
                                    expectedCenter: viewportWidth >= 768 && viewportWidth < 1024,
                                  },
                                  timestamp: Date.now(),
                                  sessionId: "debug-session",
                                  runId: "run1",
                                  hypothesisId: "D",
                                }),
                              }).catch(() => {});
                            }
                            // #endregion
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-soft text-lg md:h-10 md:w-10">
                            <CategoryEmoji code={cat.id} />
                          </span>
                          <span
                            ref={(el: HTMLElement | null) => {
                              // #region agent log
                              if (el) {
                                const display = window.getComputedStyle(el).display;
                                const width = window.getComputedStyle(el).width;
                                const textEl = el.querySelector("span");
                                const textWidth = textEl ? window.getComputedStyle(textEl).width : "unknown";
                                const textOverflow = textEl ? window.getComputedStyle(textEl).textOverflow : "unknown";
                                fetch("http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    location: "CatalogPageClient.tsx:433",
                                    message: "Text visibility and truncation check",
                                    data: {
                                      categoryName: cat.name,
                                      textContainerDisplay: display,
                                      textContainerWidth: width,
                                      textWidth,
                                      textOverflow,
                                      viewportWidth: window.innerWidth,
                                    },
                                    timestamp: Date.now(),
                                    sessionId: "debug-session",
                                    runId: "run1",
                                    hypothesisId: "C",
                                  }),
                                }).catch(() => {});
                              }
                              // #endregion
                            }}
                            className="hidden min-w-0 flex-col lg:flex"
                          >
                            <span className="truncate text-sm leading-tight">{cat.name}</span>
                            {cat.isPromo && (
                              <span className="mt-0.5 truncate text-[10px] text-slate-500">
                                Акции и спецпредложения
                              </span>
                            )}
                          </span>
                        </span>

                        <ChevronRight
                          className={[
                            "hidden h-4 w-4 shrink-0 text-slate-400 transition-transform lg:block",
                            isExpanded ? "rotate-90" : "",
                          ].join(" ")}
                        />
                      </button>

                      {isExpanded && subsForCat.length > 0 && (
                        <div className="mt-1 hidden space-y-0.5 pl-0 lg:block lg:pl-3">
                          {subsForCat.map((sub) => {
                            const isSubActive = activeSubcategoryId === sub.id;

                            return (
                              <div key={sub.id}>
                                <button
                                  type="button"
                                  onClick={() => handleSubcategoryClick(sub.id)}
                                  title={sub.name}
                                  className={[
                                    "flex w-full min-w-0 items-center justify-between rounded-2xl px-3 py-1.5 text-left text-xs transition",
                                    isSubActive
                                      ? "bg-surface-soft text-slate-900 font-medium"
                                      : "bg-transparent text-slate-700 hover:bg-surface-soft",
                                  ].join(" ")}
                                >
                                  <span className="truncate">{sub.name}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-vilka-soft">
            {/* Информационный блок */}
            <div className="rounded-[var(--vilka-radius-xl)] border border-surface-soft bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-md">
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-slate-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Горячая еда за 25–35 минут</span>
                  </div>
                  <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                    Рестораны и пекарни
                    <br />
                    в одной доставке.
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Заведения размещают свои блюда в Вилке и могут скрыть бренд. Вы выбираете — анонимное
                    предложение или конкретный ресторан рядом.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-3xl bg-surface-soft p-4 text-sm sm:w-64">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Минимальная сумма заказа</span>
                    <span className="text-sm font-semibold text-slate-900">от 0 ₽</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Доставка из заведений</span>
                    <span className="text-sm font-semibold text-slate-900">от 0 ₽</span>
                  </div>
                  <button className="mt-2 inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                    Посмотреть заведения
                  </button>
                </div>
              </div>
            </div>
              <div className="text-xs">
                {/* Level 1: not clickable */}
                {currentCategory?.name ? (
                  <span className="text-slate-500">{currentCategory.name}</span>
                ) : (
                  <span className="text-slate-500">Категория</span>
                )}

                <span className="text-slate-500"> · </span>

                {/* Level 2: highlighted when 3rd level is not selected */}
                {currentSubcategory?.id ? (
                  activeItemId ? (
                    <button
                      type="button"
                      className={breadcrumbLinkClasses}
                      onClick={() => handleSubcategoryBreadcrumbClick(currentSubcategory.id)}
                    >
                      {currentSubcategory.name}
                    </button>
                  ) : (
                    <span className={breadcrumbActiveClasses}>{currentSubcategory.name}</span>
                  )
                ) : (
                  <span className={activeItemId ? "text-slate-500" : breadcrumbActiveClasses}>Подкатегория</span>
                )}

                {/* Level 3: show only when selected */}
                {currentItem?.id && (
                  <>
                    <span className="text-slate-500"> · </span>
                    <button
                      type="button"
                      className="font-medium text-slate-800 hover:underline underline-offset-4"
                      onClick={() => handleItemClick(currentItem.id)}
                    >
                      {currentItem.name}
                    </button>
                  </>
                )}
              </div>

              {itemsForSubcategory.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {itemsForSubcategory.map((item) => (
                    <MenuOptionButton
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      isSelected={activeItemId === item.id}
                      variant="primary"
                      aria-label={`Выбрать блюдо: ${item.name}`}
                    >
                      {item.name}
                    </MenuOptionButton>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Загрузка блюд…</div>
              )}

              {activeItemId && currentItem ? (
                renderOffersBlock(currentItem, offersForItem)
              ) : itemsForSubcategory.length > 0 ? (
                <div className="flex flex-col gap-10">
                  {itemsForSubcategory.map((item) => {
                    const offers = indexes.offersByBaseItem.get(item.id) ?? [];
                    if (offers.length === 0) return null;

                    return (
                      <div key={item.id} className="flex flex-col gap-6">
                        <h2 className="text-4xl font-bold text-slate-900">{item.name}</h2>
                        {renderOffersBlock(item, offers)}
                      </div>
                    );
                  })}
                </div>
              ) : null}
          </section>

          <aside className="hidden h-full w-full shrink-0 overflow-y-auto lg:block">
            <div className="flex h-full flex-col gap-3 pb-6">
              <div className="flex flex-1 flex-col rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-vilka-soft">
                <h2 className="text-base font-semibold text-slate-900">Доставка 15 минут</h2>

                <div className="mt-2">
                  <label className="text-xs font-semibold text-slate-700">Время доставки</label>
                  <select
                    value={deliverySlot}
                    onChange={(e: { target: { value: string } }) => setDeliverySlot(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none hover:border-slate-300 focus:border-brand"
                  >
                    <option value="asap">Как можно скорее</option>
                    <option value="by-1930">К 19:30</option>
                    <option value="20-2030">С 20:00 до 20:30</option>
                    <option value="custom">Другое (указать при оформлении)</option>
                  </select>
                  {/* TODO: persist deliverySlot to cart model when backend is ready */}
                </div>

                {totals.totalCount === 0 ? (
                  <div className="mt-3 text-xs text-slate-600">
                    В вашей корзине пока пусто. Добавляйте блюда с карточек справа, чтобы увидеть итог по заказу.
                  </div>
                ) : (
                  <>
                    <div className="mt-3 space-y-3">
                      {entries.map(({ offer, quantity, lineTotal, lineOldPrice }) => {
                        const isSoldOut =
                          (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;
                        const base = baseItems.find((i) => i.id === offer.baseItemId);
                        const noteState = lineNotes[offer.id] ?? { comment: "", allowReplacement: true };

                        return (
                          <div key={offer.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-surface-soft">
                                {offer.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={offer.imageUrl}
                                    alt={offer.menuItemName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="px-2 text-center text-[11px] font-medium text-slate-500">
                                    пока ещё нет фото!
                                  </span>
                                )}
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col">
                                <div className="line-clamp-2 text-sm font-semibold text-slate-900">
                                  {offer.menuItemName}
                                </div>

                                {base?.description && (
                                  <div className="mt-0.5 text-[11px] text-slate-500">{base.description}</div>
                                )}

                                <button
                                  type="button"
                                  className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 active:scale-95 transition-transform transform-gpu"
                                  onClick={async () => {
                                    const next = !lineFavorites[offer.id];
                                    setLineFavorites((prev) => ({ ...prev, [offer.id]: next }));
                                    try {
                                      await fetch("/api/favorites/toggle", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          userId: 1,
                                          menuItemId: Number(offer.baseItemId),
                                          favorite: next,
                                        }),
                                      });
                                    } catch (e) {
                                      console.error("favorite toggle failed", e);
                                    }
                                  }}
                                >
                                  <Heart
                                    className={[
                                      "h-3.5 w-3.5",
                                      lineFavorites[offer.id] ? "fill-red-500 stroke-red-500" : "stroke-slate-500",
                                    ].join(" ")}
                                  />
                                  <span>{lineFavorites[offer.id] ? "В избранном" : "В избранное"}</span>
                                </button>

                                <div className="mt-2 flex items-center justify-between rounded-full bg-surface-soft px-3 py-1.5">
                                  {/* Анимация нажатия на +/- */}
                                  <div className="[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95">
                                    <QuantityControls
                                      quantity={quantity}
                                      onAdd={() => handleAddToCart(offer.id)}
                                      onRemove={() => remove(offer.id)}
                                      canAdd={!isSoldOut}
                                      size="sm"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {lineOldPrice && (
                                      <span className="text-xs text-slate-400 line-through">{lineOldPrice} ₽</span>
                                    )}
                                    <span className="text-sm font-semibold text-slate-900">{lineTotal} ₽</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <label className="text-[11px] font-semibold text-slate-700">Комментарий для кухни</label>
                              <textarea
                                value={noteState.comment}
                                onChange={(e: { target: { value: string } }) =>
                                  setLineNotes((prev) => ({
                                    ...prev,
                                    [offer.id]: { ...noteState, comment: e.target.value },
                                  }))
                                }
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none hover:border-slate-300 focus:border-brand"
                                placeholder="Без лука, соус отдельно..."
                              />
                              <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={noteState.allowReplacement}
                                  onChange={(e: { target: { checked: boolean } }) =>
                                    setLineNotes((prev) => ({
                                      ...prev,
                                      [offer.id]: { ...noteState, allowReplacement: e.target.checked },
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                                />
                                Если нет в наличии — разрешить замену
                              </label>
                              {/* TODO: persist comment + replacement policy to backend cart lines */}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="text-center text-xs text-slate-500">Итого</div>
                      <div className="text-center text-2xl font-semibold leading-tight text-slate-900">
                        {totals.totalPrice} ₽
                      </div>
                      <button className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:bg-brand-dark active:scale-[0.98] transition-transform transform-gpu">
                        Продолжить
                      </button>
                    </div>
                  </>
                )}
              </div>

              {totals.totalCount > 0 && (
                <div className="rounded-3xl bg-white/90 p-3 shadow-vilka-soft">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="save-cart-name"
                        type="text"
                        placeholder="Например: Обед в офис"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                        onChange={() => {}}
                      />
                      <button
                        type="button"
                        className="rounded-2xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark active:scale-95 transition-transform transform-gpu"
                        onClick={async () => {
                          const nameInput = document.getElementById("save-cart-name") as HTMLInputElement | null;
                          const name = nameInput?.value?.trim();
                          if (!name) return;
                          try {
                            await fetch("/api/cart/save", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ cartId: 1, userId: 1, name }),
                            });
                          } catch (e) {
                            console.error("save cart failed", e);
                          }
                        }}
                      >
                        Сохранить сет
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="apply-saved-id"
                        type="number"
                        placeholder="ID сохранённого сета"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300 active:scale-95 transition-transform transform-gpu"
                        onClick={async () => {
                          const input = document.getElementById("apply-saved-id") as HTMLInputElement | null;
                          const id = input?.value;
                          if (!id) return;
                          try {
                            await fetch("/api/cart/apply-saved", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ savedCartId: Number(id) }),
                            });
                          } catch (e) {
                            console.error("apply saved failed", e);
                          }
                        }}
                      >
                        Повторить сет
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 shadow-vilka-soft">
                <p className="font-semibold text-slate-800">Вилка пока не везде</p>
                <p className="mt-1">Укажите адрес, чтобы увидеть заведения, которые доставляют именно к вам.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="shrink-0 border-t border-slate-200/70 bg-white/80">
        <div className="flex w-full flex-col gap-2 px-6 py-3 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Вилка. Доставка еды из ресторанов и пекарен.</span>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 active:scale-95 transition-transform transform-gpu">
              Вопросы и поддержка
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 active:scale-95 transition-transform transform-gpu">
              Условия сервиса
            </button>
            <a
              href="/business"
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 active:scale-95 transition-transform transform-gpu"
            >
              Для бизнеса
            </a>
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => {
          setIsAuthOpen(false);
          setPendingAddOfferId(null);
        }}
        onSuccess={() => {
          // После успешного входа загружаем информацию о пользователе
          fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
              setUser(data.user);
              if (data.user && pendingAddOfferId != null) {
                add(pendingAddOfferId);
                setPendingAddOfferId(null);
                setIsAuthOpen(false);
              }
            })
            .catch(err => console.error("Failed to load user:", err));
        }}
      />
      <AddressModal
        isOpen={isAddressOpen}
        onClose={() => setIsAddressOpen(false)}
        onSelectAddress={(label: string) => setCurrentAddressLabel(label)}
      />
      <AIAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </main>
  );
}

export default function CatalogPageClient(props: CatalogPageClientProps) {
  const indexes = useMemo(() => buildCatalogIndexes(props.catalog), [props.catalog]);
  return (
    <CartProvider offers={props.catalog.offers}>
      <CatalogUI catalog={props.catalog} indexes={indexes} />
    </CartProvider>
  );
}
