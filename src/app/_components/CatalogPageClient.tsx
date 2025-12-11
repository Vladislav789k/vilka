"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  MapPin,
  User,
  Search,
  Clock,
  ChevronRight,
} from "lucide-react";

import AuthModal from "@/components/AuthModal";
import AddressModal from "@/components/AddressModal";
import AnonymousOfferCard from "@/components/AnonymousOfferCard";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import { MenuOptionButton } from "@/components/MenuOptionButton";
import { QuantityControls } from "@/components/QuantityControls";
import { Heart } from "lucide-react";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import { buildCatalogIndexes } from "@/modules/catalog/indexes";
import { ensureValidSelection, type Selection } from "@/modules/catalog/selection";
import type {
  BaseItemId,
  CatalogData,
  CategoryId,
  SubcategoryId,
} from "@/modules/catalog/types";

type CatalogPageClientProps = {
  catalog: CatalogData;
};

type CatalogIndexes = ReturnType<typeof buildCatalogIndexes>;

function getInitialSelection(catalog: CatalogData): Selection {
  const firstCategory = catalog.categories[0]?.id ?? null;
  const firstSub = firstCategory
    ? catalog.subcategories.find((s) => s.categoryId === firstCategory) ?? null
    : null;
  const firstItem =
    firstSub &&
    catalog.baseItems.find((i) => i.subcategoryId === firstSub.id);

  return {
    categoryId: firstCategory,
    subcategoryId: firstSub?.id ?? null,
    itemId: firstItem?.id ?? null,
  };
}

function CategoryEmoji({ code }: { code: string }) {
  const emoji =
    code.startsWith("bakery") ? "🥐" :
    code.startsWith("breakfasts") ? "🍳" :
    code.startsWith("snacks") ? "🥨" :
    code.startsWith("salads") ? "🥗" :
    code.startsWith("soups") ? "🥣" :
    code.startsWith("pizza") ? "🍕" :
    code.startsWith("burgers") ? "🍔" :
    code.startsWith("hot") ? "🍽️" :
    code.startsWith("pasta") ? "🍝" :
    code.startsWith("desserts") ? "🍰" :
    code.startsWith("drinks") ? "🥤" :
    code.startsWith("combos") ? "🧺" :
    "🍴";
  return <span>{emoji}</span>;
}

function CatalogUI({ catalog, indexes }: CatalogPageClientProps & { indexes: CatalogIndexes }) {
  const { quantities, entries, totals, add, remove } = useCart();

  // #region agent log
  useEffect(() => {
    const logViewport = () => {
      const width = window.innerWidth;
      const sidebarEl = document.querySelector('aside[class*="hidden"]');
      const computedWidth = sidebarEl ? window.getComputedStyle(sidebarEl).width : 'unknown';
      const gridEl = document.querySelector('div[class*="grid-cols"]');
      const gridTemplate = gridEl ? window.getComputedStyle(gridEl).gridTemplateColumns : 'unknown';
      fetch('http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CatalogPageClient.tsx:69',message:'Viewport and layout check',data:{viewportWidth:width,sidebarWidth:computedWidth,gridTemplate,breakpoint:width>=1280?'xl':width>=1024?'lg':width>=768?'md':'sm'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    };
    logViewport();
    window.addEventListener('resize', logViewport);
    return () => window.removeEventListener('resize', logViewport);
  }, []);
  // #endregion

  const [searchQuery, setSearchQuery] = useState("");
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState<string>("asap");
  const [lineNotes, setLineNotes] = useState<
    Record<string, { comment: string; allowReplacement: boolean }>
  >({});
  const [lineFavorites, setLineFavorites] = useState<Record<string, boolean>>({});
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [currentAddressLabel, setCurrentAddressLabel] =
    useState<string>("Указать адрес доставки");

  const initial = useMemo(() => getInitialSelection(catalog), [catalog]);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | null>(
    initial.categoryId
  );
  const [activeSubcategoryId, setActiveSubcategoryId] =
    useState<SubcategoryId | null>(initial.subcategoryId);
  const [activeItemId, setActiveItemId] = useState<BaseItemId | null>(
    initial.itemId
  );
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<CategoryId[]>(
    initial.categoryId ? [initial.categoryId] : []
  );

  const { categories, subcategories, baseItems, offers } = catalog;

  useEffect(() => {
    const next = ensureValidSelection(
      { categoryId: activeCategoryId, subcategoryId: activeSubcategoryId, itemId: activeItemId },
      indexes
    );
    if (next.subcategoryId !== activeSubcategoryId) {
      setActiveSubcategoryId(next.subcategoryId);
    }
    if (next.itemId !== activeItemId) {
      setActiveItemId(next.itemId);
    }
  }, [activeCategoryId, activeSubcategoryId, activeItemId, indexes]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    if (catalog.baseItems.length === 0) return;

    const matchedItem =
      catalog.baseItems.find((i) => i.name.toLowerCase().includes(q)) ||
      catalog.baseItems.find((i) =>
        (i.description ?? "").toLowerCase().includes(q)
      );

    if (!matchedItem) return;

    setActiveCategoryId(matchedItem.categoryId);
    setActiveSubcategoryId(matchedItem.subcategoryId);
    setActiveItemId(matchedItem.id);
    setExpandedCategoryIds((prev) =>
      prev.includes(matchedItem.categoryId)
        ? prev
        : [...prev, matchedItem.categoryId]
    );
  }, [searchQuery, catalog]);

  const toggleCategoryExpanded = (categoryId: CategoryId) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    setActiveCategoryId(categoryId);
    toggleCategoryExpanded(categoryId);
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId) => {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (!sub) return;

    setActiveCategoryId(sub.categoryId);
    setActiveSubcategoryId(sub.id);
    setExpandedCategoryIds((prev) =>
      prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]
    );

    const itemsForSub = indexes.itemsBySubcategory.get(sub.id) ?? [];
    if (itemsForSub.length > 0) {
      setActiveItemId(itemsForSub[0].id);
    }
  };

  const handleItemClickFromTree = (itemId: BaseItemId) => {
    const item = baseItems.find((i) => i.id === itemId);
    if (!item) return;

    setActiveCategoryId(item.categoryId);
    setActiveSubcategoryId(item.subcategoryId);
    setActiveItemId(item.id);
    setExpandedCategoryIds((prev) =>
      prev.includes(item.categoryId) ? prev : [...prev, item.categoryId]
    );
  };

  const subcategoriesForCategory = useMemo(
    () =>
      activeCategoryId
        ? indexes.subcategoriesByCategory.get(activeCategoryId) ?? []
        : [],
    [activeCategoryId, indexes]
  );

  const itemsForSubcategory = useMemo(
    () =>
      activeSubcategoryId
        ? indexes.itemsBySubcategory.get(activeSubcategoryId) ?? []
        : [],
    [activeSubcategoryId, indexes]
  );

  const offersForItem = useMemo(
    () =>
      activeItemId
        ? indexes.offersByBaseItem.get(activeItemId) ?? []
        : [],
    [activeItemId, indexes]
  );

  const anonOffer = offersForItem.find((o) => o.isAnonymous);
  const brandedOffers = offersForItem.filter((o) => !o.isAnonymous);

  const cartButtonLabel =
    totals.totalPrice > 0 ? `${totals.totalPrice} ₽` : "0 ₽";
  const cartCountLabel = totals.totalCount > 0 ? `${totals.totalCount}` : "0";

  const currentCategory = categories.find((c) => c.id === activeCategoryId);
  const currentSubcategory = subcategories.find(
    (s) => s.id === activeSubcategoryId
  );
  const currentItem = baseItems.find((i) => i.id === activeItemId);

  return (
    <main className="flex flex-1 flex-col bg-surface-soft">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="hidden md:block">
          <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-3">
              <Link
                href="/"
                className="flex items-center gap-2 transition hover:opacity-80"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                  <span className="text-lg font-bold text-brand-dark">V</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-semibold text-slate-900">
                    Вилка
                  </span>
                  <span className="text-xs text-slate-600">
                    Еда из ресторанов и пекарен
                  </span>
                </div>
              </Link>

              <div className="hidden flex-1 items-center md:flex">
                <div className="flex w-full items-center gap-3 rounded-full bg-surface-soft px-4 py-2 shadow-vilka-soft">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Найти ресторан или блюдо..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddressOpen(true)}
                  className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="max-w-[220px] truncate">
                    {currentAddressLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Войти</span>
                </button>

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
                          <div className="text-xs text-slate-500">
                            В корзине пока пусто
                          </div>
                        ) : (
                          entries.map(({ offer, quantity }) => (
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
                              <QuantityControls
                                quantity={quantity}
                                onAdd={() => add(offer.id)}
                                onRemove={() => remove(offer.id)}
                                size="sm"
                              />
                            </div>
                          ))
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
            <Link
              href="/"
              className="flex items-center gap-2 transition hover:opacity-80"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                <span className="text-base font-bold text-brand-dark">V</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsAddressOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{currentAddressLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              <User className="h-4 w-4" />
            </button>

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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 pt-4 md:pb-8 md:pt-6">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          {/* #region agent log */}
          <aside 
            ref={(el) => {
              if (el) {
                const width = window.getComputedStyle(el).width;
                const display = window.getComputedStyle(el).display;
                const firstBtn = el.querySelector('button');
                const btnTextVisible = firstBtn ? window.getComputedStyle(firstBtn.querySelector('span[class*="hidden"]') as Element).display !== 'none' : false;
                fetch('http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CatalogPageClient.tsx:399',message:'Sidebar render check',data:{sidebarWidth:width,display,textVisible:btnTextVisible,viewportWidth:window.innerWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              }
            }}
            className="hidden w-full rounded-3xl bg-white shadow-vilka-soft md:block md:w-auto md:border md:border-slate-100">
          {/* #endregion */}
            <div className="rounded-3xl bg-white p-2 md:p-3">
              <h2 className="hidden px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:block">
                Категории
              </h2>

            <nav className="flex flex-col gap-1">
              {categories.map((cat) => {
                const isCatActive = activeCategoryId === cat.id;
                const isExpanded = expandedCategoryIds.includes(cat.id);

                const subsForCat = subcategories.filter(
                  (s) => s.categoryId === cat.id
                );

                return (
                  <div key={cat.id} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(cat.id)}
                      title={cat.name}
                      onMouseEnter={(e) => {
                        // #region agent log
                        const el = e.currentTarget;
                        const tooltipEl = window.getComputedStyle(el, '::after');
                        const tooltipOpacity = tooltipEl.opacity;
                        const viewportWidth = window.innerWidth;
                        fetch('http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CatalogPageClient.tsx:416',message:'Tooltip hover check',data:{categoryName:cat.name,viewportWidth,tooltipOpacity,hasTooltipClass:el.classList.contains('tooltip-icon-only')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
                        ref={(el) => {
                          // #region agent log
                          if (el) {
                            const justifyContent = window.getComputedStyle(el).justifyContent;
                            const viewportWidth = window.innerWidth;
                            fetch('http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CatalogPageClient.tsx:429',message:'Icon container alignment check',data:{categoryName:cat.name,justifyContent,viewportWidth,expectedCenter:viewportWidth>=768&&viewportWidth<1024},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                          }
                          // #endregion
                        }}
                        className="flex items-center gap-2 lg:gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-soft text-lg md:h-10 md:w-10">
                          <CategoryEmoji code={cat.id} />
                        </span>
                        <span 
                          ref={(el) => {
                            // #region agent log
                            if (el) {
                              const display = window.getComputedStyle(el).display;
                              const width = window.getComputedStyle(el).width;
                              const textEl = el.querySelector('span');
                              const textWidth = textEl ? window.getComputedStyle(textEl).width : 'unknown';
                              const textOverflow = textEl ? window.getComputedStyle(textEl).textOverflow : 'unknown';
                              fetch('http://127.0.0.1:7242/ingest/fa8b72b8-bfd9-4262-93cd-9bb477f82934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CatalogPageClient.tsx:433',message:'Text visibility and truncation check',data:{categoryName:cat.name,textContainerDisplay:display,textContainerWidth:width,textWidth,textOverflow,viewportWidth:window.innerWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                            }
                            // #endregion
                          }}
                          className="hidden flex-col lg:flex">
                          <span className="text-sm leading-tight truncate max-w-[140px] xl:max-w-[180px]">
                            {cat.name}
                          </span>
                          {cat.isPromo && (
                            <span className="mt-0.5 text-[10px] text-slate-500 truncate max-w-[140px] xl:max-w-[180px]">
                              Акции и спецпредложения
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight
                        className={[
                          "h-4 w-4 shrink-0 text-slate-400 transition-transform hidden lg:block",
                          isExpanded ? "rotate-90" : "",
                        ].join(" ")}
                      />
                    </button>

                    {isExpanded && subsForCat.length > 0 && (
                      <div className="mt-1 space-y-0.5 pl-0 lg:pl-3 hidden lg:block">
                        {subsForCat.map((sub) => {
                          const isSubActive = activeSubcategoryId === sub.id;
                          const itemsForSub = baseItems.filter(
                            (i) => i.subcategoryId === sub.id
                          );

                          return (
                            <div key={sub.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSubcategoryClick(sub.id)
                                }
                                title={sub.name}
                                className={[
                                  "flex w-full items-center justify-between rounded-2xl px-3 py-1.5 text-left text-xs transition",
                                  isSubActive
                                    ? "bg-surface-soft text-slate-900 font-medium"
                                    : "bg-transparent text-slate-700 hover:bg-surface-soft",
                                ].join(" ")}
                              >
                                <span className="truncate max-w-[140px] xl:max-w-[180px]">
                                  {sub.name}
                                </span>
                              </button>

                              {isSubActive && itemsForSub.length > 0 && (
                                <div className="mt-0.5 space-y-0.5 pl-4">
                                  {itemsForSub.map((item) => {
                                    const isItemActive =
                                      activeItemId === item.id;
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() =>
                                          handleItemClickFromTree(item.id)
                                        }
                                        title={item.name}
                                        className={[
                                          "w-full rounded-2xl px-2 py-1 text-left text-[11px] transition",
                                          isItemActive
                                            ? "text-slate-400"
                                            : "text-slate-700 hover:text-slate-900",
                                        ].join(" ")}
                                      >
                                        <span className="truncate block max-w-[140px] xl:max-w-[180px]">
                                          {item.name}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
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

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <section className="overflow-hidden rounded-[var(--vilka-radius-xl)] border border-surface-soft bg-white shadow-vilka-soft">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
                  Заведения размещают свои блюда в Вилке и могут скрыть бренд.
                  Вы выбираете — анонимное предложение или конкретный ресторан
                  рядом.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-3xl bg-surface-soft p-4 text-sm sm:w-64">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    Минимальная сумма заказа
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    от 0 ₽
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    Доставка из заведений
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    от 0 ₽
                  </span>
                </div>
                <button className="mt-2 inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                  Посмотреть заведения
                </button>
              </div>
        </div>
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-vilka-soft">
            <div className="text-xs text-slate-500">
              {currentCategory?.name ?? "Категория"} <span>·</span>{" "}
              {currentSubcategory?.name ?? "Подкатегория"} <span>·</span>{" "}
              <span className="font-medium text-slate-800">
                {currentItem?.name ?? "Позиция"}
              </span>
            </div>

            {subcategoriesForCategory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subcategoriesForCategory.map((sub) => (
                  <MenuOptionButton
                    key={sub.id}
                    onClick={() => handleSubcategoryClick(sub.id)}
                    isSelected={activeSubcategoryId === sub.id}
                    variant="default"
                    aria-label={`Выбрать подкатегорию: ${sub.name}`}
                  >
                    {sub.name}
                  </MenuOptionButton>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Нет доступных подкатегорий
              </div>
            )}

            {itemsForSubcategory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {itemsForSubcategory.map((item) => (
                  <MenuOptionButton
                    key={item.id}
                    onClick={() => setActiveItemId(item.id)}
                    isSelected={activeItemId === item.id}
                    variant="primary"
                    aria-label={`Выбрать блюдо: ${item.name}`}
                  >
                    {item.name}
                  </MenuOptionButton>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Загрузка блюд…
              </div>
            )}

            {currentItem && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                {currentItem.description}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              {anonOffer ? (
                <AnonymousOfferCard
                  name={anonOffer.menuItemName}
                  price={anonOffer.price}
                  oldPrice={anonOffer.oldPrice}
                  tag={anonOffer.tag}
                  subtitle="Анонимное заведение. Подберём самый дешёвый и ближайший вариант"
                  imageUrl={anonOffer.imageUrl ?? undefined}
                  quantity={quantities[anonOffer.id] ?? 0}
                  onAdd={() => add(anonOffer.id)}
                  onRemove={() => remove(anonOffer.id)}
                />
              ) : (
                <div className="flex flex-col justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
                  Для этой позиции пока нет анонимных предложений.
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Из заведений рядом
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Заведения, которые показывают свой бренд
                  </span>
                </div>

                {brandedOffers.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Пока нет брендированных предложений для этой позиции.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {brandedOffers.map((offer) => (
                      <BrandedOfferCard
                        key={offer.id}
                        itemName={offer.menuItemName}
                        brand={offer.brand}
                        price={offer.price}
                        oldPrice={offer.oldPrice}
                        tag={offer.tag}
                        subtitle="0,45 л"
                        imageUrl={offer.imageUrl ?? undefined}
                        quantity={quantities[offer.id] ?? 0}
                        onAdd={() => add(offer.id)}
                        onRemove={() => remove(offer.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="hidden w-full shrink-0 lg:block">
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-1 flex-col rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-vilka-soft">
              <h2 className="text-base font-semibold text-slate-900">
                Доставка 15 минут
              </h2>

              <div className="mt-2">
                <label className="text-xs font-semibold text-slate-700">
                  Время доставки
                </label>
                <select
                  value={deliverySlot}
                  onChange={(e) => setDeliverySlot(e.target.value)}
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
                  В вашей корзине пока пусто. Добавляйте блюда с карточек
                  справа, чтобы увидеть итог по заказу.
                </div>
              ) : (
                <>
                  <div className="mt-3 space-y-3">
                    {entries.map(({ offer, quantity, lineTotal, lineOldPrice }) => {
                      const base = baseItems.find(
                        (i) => i.id === offer.baseItemId
                      );
                      const noteState = lineNotes[offer.id] ?? {
                        comment: "",
                        allowReplacement: true,
                      };

                      return (
                        <div
                          key={offer.id}
                          className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-3"
                        >
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
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {base.description}
                                </div>
                              )}
                              <button
                                type="button"
                                className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300"
                                onClick={async () => {
                                  const next = !lineFavorites[offer.id];
                                  setLineFavorites((prev) => ({
                                    ...prev,
                                    [offer.id]: next,
                                  }));
                                  try {
                                    // TODO: заменить на реальный userId из сессии
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
                                    lineFavorites[offer.id]
                                      ? "fill-red-500 stroke-red-500"
                                      : "stroke-slate-500",
                                  ].join(" ")}
                                />
                                <span>
                                  {lineFavorites[offer.id]
                                    ? "В избранном"
                                    : "В избранное"}
                                </span>
                              </button>
                              <div className="mt-2 flex items-center justify-between rounded-full bg-surface-soft px-3 py-1.5">
                                <QuantityControls
                                  quantity={quantity}
                                  onAdd={() => add(offer.id)}
                                  onRemove={() => remove(offer.id)}
                                  size="sm"
                                />
                                <div className="flex items-center gap-2">
                                  {lineOldPrice && (
                                    <span className="text-xs text-slate-400 line-through">
                                      {lineOldPrice} ₽
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-slate-900">
                                    {lineTotal} ₽
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <label className="text-[11px] font-semibold text-slate-700">
                              Комментарий для кухни
                            </label>
                            <textarea
                              value={noteState.comment}
                              onChange={(e) =>
                                setLineNotes((prev) => ({
                                  ...prev,
                                  [offer.id]: {
                                    ...noteState,
                                    comment: e.target.value,
                                  },
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
                                onChange={(e) =>
                                  setLineNotes((prev) => ({
                                    ...prev,
                                    [offer.id]: {
                                      ...noteState,
                                      allowReplacement: e.target.checked,
                                    },
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
                    <div className="text-center text-xs text-slate-500">
                      Итого
                    </div>
                    <div className="text-center text-2xl font-semibold leading-tight text-slate-900">
                      {totals.totalPrice} ₽
                    </div>
                    <button className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:bg-brand-dark">
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
                      className="rounded-2xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                      onClick={async () => {
                        // TODO: связать с реальным cartId / userId
                        const nameInput = document.getElementById(
                          "save-cart-name"
                        ) as HTMLInputElement | null;
                        const name = nameInput?.value?.trim();
                        if (!name) return;
                        try {
                          await fetch("/api/cart/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              cartId: 1,
                              userId: 1,
                              name,
                            }),
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
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300"
                      onClick={async () => {
                        const input = document.getElementById(
                          "apply-saved-id"
                        ) as HTMLInputElement | null;
                        const id = input?.value;
                        if (!id) return;
                        try {
                          await fetch("/api/cart/apply-saved", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              savedCartId: Number(id),
                            }),
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
              <p className="font-semibold text-slate-800">
                Вилка пока не везде
              </p>
              <p className="mt-1">
                Укажите адрес, чтобы увидеть заведения, которые доставляют
                именно к вам.
              </p>
            </div>
          </div>
        </aside>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-white/80">
        <div className="flex w-full flex-col gap-2 px-6 py-3 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} Вилка. Доставка еды из ресторанов и
            пекарен.
          </span>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900">
              Вопросы и поддержка
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900">
              Условия сервиса
            </button>
            <a
              href="/business"
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
            >
              Для бизнеса
            </a>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <AddressModal
        isOpen={isAddressOpen}
        onClose={() => setIsAddressOpen(false)}
        onSelectAddress={(label) => setCurrentAddressLabel(label)}
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

