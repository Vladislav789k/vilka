"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { MapPin, User, Search, Clock, ChevronRight, MessageCircle } from "lucide-react";

import AuthModal from "@/components/AuthModal";
import AddressModal from "@/components/AddressModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import AnonymousOfferCard from "@/components/AnonymousOfferCard";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import { MenuOptionButton } from "@/components/MenuOptionButton";
import { QuantityControls } from "@/components/QuantityControls";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import { buildCatalogIndexes } from "@/modules/catalog/indexes";
import { ensureValidSelection, type Selection } from "@/modules/catalog/selection";
import type { BaseItemId, CatalogData, CategoryId, SubcategoryId } from "@/modules/catalog/types";
import { normalizeRu, normalizeAndTokenizeRu } from "@/lib/search/normalizeRu";
import { buildQueryVariants } from "@/lib/search/keyboardLayout";
import { isSimilar } from "@/lib/search/levenshtein";

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
  const { quantities, entries, totals, offerStocks, add, remove, removeLine, reload: reloadCart, lastServerMessages } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  // Search index is built for CARD TITLES (offer.menuItemName), not for categories/baseItems.
  type OfferTitleIndexEntry = {
    offer: (typeof catalog.offers)[number];
    normalizedTitle: string;
    titleTokens: string[];
  };
  type OfferTitleSearchResult = { offer: (typeof catalog.offers)[number]; score: number };
  type SearchSuggestion = { label: string; completion: string; next: string | null };

  const [searchResults, setSearchResults] = useState<OfferTitleSearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const searchAnchorRefDesktop = useRef<HTMLDivElement | null>(null);
  const searchAnchorRefMobile = useRef<HTMLDivElement | null>(null);
  const activeSearchAnchorElRef = useRef<HTMLElement | null>(null);
  const [searchAnchorRect, setSearchAnchorRect] = useState<{ left: number; top: number; width: number } | null>(
    null
  );
  // delivery time selection removed
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [currentAddressLabel, setCurrentAddressLabel] = useState<string>("Указать адрес доставки");
  const [user, setUser] = useState<{
    id: number;
    phone: string;
    role: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null>(null);
  const [pendingAddOfferId, setPendingAddOfferId] = useState<string | null>(null);
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

  // Build search index by offers (CARD TITLES)
  const searchIndex = useMemo(() => {
    const idx = new Map<string, OfferTitleIndexEntry>();
    for (const offer of catalog.offers) {
      const title = offer.menuItemName ?? "";
      idx.set(offer.id, {
        offer,
        normalizedTitle: normalizeRu(title),
        titleTokens: normalizeAndTokenizeRu(title),
      });
    }
    return idx;
  }, [catalog.offers]);

  const baseItemById = useMemo(() => new Map(baseItems.map((b) => [b.id, b])), [baseItems]);

  useEffect(() => {
    const next = ensureValidSelection(
      { categoryId: activeCategoryId, subcategoryId: activeSubcategoryId, itemId: activeItemId },
      indexes
    );
    if (next.subcategoryId !== activeSubcategoryId) setActiveSubcategoryId(next.subcategoryId);
    if (next.itemId !== activeItemId) setActiveItemId(next.itemId);
  }, [activeCategoryId, activeSubcategoryId, activeItemId, indexes]);

  const isSearching = searchQuery.trim().length >= 2;

  const clearSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchQuery("");
    setSearchResults([]);
    setSearchSuggestions([]);
    setIsSearchFocused(false);
  };

  const updateSearchAnchorRect = (el: HTMLElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSearchAnchorRect({
      left: Math.max(12, r.left),
      top: r.bottom - 1,
      width: Math.max(240, r.width),
    });
  };

  // Keep suggestion popup aligned to the active search input while focused
  useEffect(() => {
    if (!isSearchFocused) return;
    const handler = () => updateSearchAnchorRect(activeSearchAnchorElRef.current);
    handler();
    window.addEventListener("resize", handler);
    // capture scroll from nested containers too
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isSearchFocused]);

  const maxTypoDistance = (len: number): number => {
    if (len >= 3 && len <= 6) return 1;
    if (len >= 7 && len <= 10) return 2;
    if (len > 10) return 3;
    return 0;
  };

  // Search scoring function: ONLY matches against card titles (titleTokens, normalizedTitle)
  // Does NOT use categories, subcategories, or descriptions
  const scoreTitleEntry = (
    entry: OfferTitleIndexEntry,
    queryTokens: string[],
    normalizedQuery: string,
    allowFuzzy: boolean
  ): { score: number; matchedAll: boolean } => {
    // Exact / prefix match for the whole title
    if (normalizedQuery && entry.normalizedTitle === normalizedQuery) return { score: 20, matchedAll: true };
    if (normalizedQuery && entry.normalizedTitle.startsWith(normalizedQuery)) return { score: 15, matchedAll: true };

    let total = 0;
    for (const q of queryTokens) {
      let best = 0;
      let matched = false;

      for (const t of entry.titleTokens) {
        if (q === t) {
          matched = true;
          best = Math.max(best, 10);
          continue;
        }
        if (t.startsWith(q)) {
          matched = true;
          best = Math.max(best, 6);
          continue;
        }
      }

      if (!matched && allowFuzzy) {
        for (const t of entry.titleTokens) {
          const maxLen = Math.max(q.length, t.length);
          const d = maxTypoDistance(maxLen);
          if (d > 0 && isSimilar(q, t, d)) {
            matched = true;
            best = Math.max(best, 4);
            break;
          }
        }
      }

      if (!matched && entry.normalizedTitle.includes(q)) {
        matched = true;
        best = Math.max(best, 3);
      }

      if (!matched) return { score: 0, matchedAll: false };
      total += best;
    }

    if (normalizedQuery && entry.normalizedTitle.includes(normalizedQuery)) total += 2;
    return { score: total, matchedAll: true };
  };

  const computeChipSuggestions = (rawQuery: string, results: OfferTitleSearchResult[]): SearchSuggestion[] => {
    const rawTrimEnd = rawQuery.trimEnd();
    if (!rawTrimEnd) return [];

    const variants = buildQueryVariants(rawTrimEnd);
    const candidates = new Map<string, { completion: string; next: string | null; score: number }>();

    for (const v of variants) {
      const qTokens = normalizeAndTokenizeRu(v);
      if (qTokens.length === 0) continue;

      for (const r of results.slice(0, 30)) {
        const entry = searchIndex.get(r.offer.id);
        const titleTokens = entry?.titleTokens ?? normalizeAndTokenizeRu(r.offer.menuItemName);

        let qi = 0;
        let lastMatchedTitleIdx = -1;
        for (let ti = 0; ti < titleTokens.length && qi < qTokens.length; ti++) {
          const qTok = qTokens[qi];
          const tTok = titleTokens[ti];
          const isLast = qi === qTokens.length - 1;
          const ok = isLast ? tTok.startsWith(qTok) || tTok === qTok : tTok === qTok;
          if (ok) {
            lastMatchedTitleIdx = ti;
            qi++;
          }
        }
        if (qi !== qTokens.length || lastMatchedTitleIdx === -1) continue;

        const completion = titleTokens[lastMatchedTitleIdx] ?? qTokens[qTokens.length - 1];
        const next = titleTokens[lastMatchedTitleIdx + 1] ?? null;

        const label = next ?? completion;
        const boost = Math.max(1, Math.round(r.score));
        const prev = candidates.get(label);
        candidates.set(label, { completion, next, score: (prev?.score ?? 0) + boost });
      }
    }

    return Array.from(candidates.entries())
      .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0], "ru"))
      .slice(0, 6)
      .map(([label, v]) => ({ label, completion: v.completion, next: v.next }));
  };

  const applySuggestion = (query: string, s: SearchSuggestion) => {
    const raw = query;
    const endsWithSpace = /\s$/.test(raw);
    const words = raw.trim().length > 0 ? raw.trim().split(/\s+/) : [];

    if (words.length === 0) {
      const nextParts = [s.completion, ...(s.next ? [s.next] : [])];
      setSearchQuery(nextParts.join(" ") + " ");
      return;
    }

    if (!endsWithSpace) {
      words[words.length - 1] = s.completion;
    }
    if (s.next) words.push(s.next);
    setSearchQuery(words.join(" ") + " ");
  };

  // Search logic: filter offers as user types (CARD TITLES only; supports typos + wrong keyboard layout)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }

    const variants = buildQueryVariants(q);
    const allowFuzzy = q.length >= 3;

    const merged = new Map<string, OfferTitleSearchResult>();
    for (const entry of searchIndex.values()) {
      let bestScore = 0;
      for (const v of variants) {
        const queryTokens = normalizeAndTokenizeRu(v);
        if (queryTokens.length === 0) continue;
        const normalizedQuery = normalizeRu(v);
        const { score, matchedAll } = scoreTitleEntry(entry, queryTokens, normalizedQuery, allowFuzzy);
        if (matchedAll) bestScore = Math.max(bestScore, score);
      }
      if (bestScore >= 3) {
        merged.set(entry.offer.id, { offer: entry.offer, score: bestScore });
      }
    }

    const results = Array.from(merged.values()).sort(
      (a, b) =>
        b.score - a.score ||
        a.offer.menuItemName.length - b.offer.menuItemName.length ||
        a.offer.menuItemName.localeCompare(b.offer.menuItemName, "ru")
    );

    setSearchResults(results.slice(0, 80));
    setSearchSuggestions(computeChipSuggestions(searchQuery, results));
  }, [searchQuery, searchIndex]);

  const toggleCategoryExpanded = (categoryId: CategoryId) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    clearSearch();
    setActiveCategoryId(categoryId);
    // Reset deeper levels: user should explicitly choose subcategory (2nd) and item (3rd).
    setActiveSubcategoryId(null);
    setActiveItemId(null);
    toggleCategoryExpanded(categoryId);
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId) => {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (!sub) return;

    clearSearch();
    setActiveCategoryId(sub.categoryId);
    setActiveSubcategoryId(sub.id);
    // 3rd level should be chosen by the user in the main content area.
    setActiveItemId(null);
    setExpandedCategoryIds((prev) => (prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]));
  };

  const handleItemClick = (itemId: BaseItemId) => {
    const item = baseItems.find((i) => i.id === itemId);
    if (!item) return;

    clearSearch();
    setActiveCategoryId(item.categoryId);
    setActiveSubcategoryId(item.subcategoryId);
    setActiveItemId(item.id);
    setExpandedCategoryIds((prev) => (prev.includes(item.categoryId) ? prev : [...prev, item.categoryId]));
  };
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") clearSearch();
  };

  const handleAddToCart = (offerId: string) => {
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
  const formatMoney = useMemo(() => new Intl.NumberFormat("ru-RU"), []);
  const cartOldTotal = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.lineOldPrice ?? e.lineTotal), 0);
  }, [entries]);

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
    <main className="flex min-h-screen flex-col bg-stone-200/70">
      {isSearchFocused && (
        <div
          className="fixed inset-0 z-30 bg-black/45"
          onMouseDown={() => setIsSearchFocused(false)}
          aria-hidden="true"
        />
      )}

      {/* Search suggestions popup: visually attached to search bar, but rendered outside header */}
      {isSearchFocused && searchSuggestions.length > 0 && searchAnchorRect && (
        <div
          className="fixed z-50"
          style={{ left: searchAnchorRect.left, top: searchAnchorRect.top, width: searchAnchorRect.width }}
        >
          <div
            className="rounded-b-2xl border border-slate-200 border-t-0 bg-white p-2 shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-wrap gap-2">
              {searchSuggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(searchQuery, s)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <header className="shrink-0 z-40 border-b border-slate-200/70 bg-stone-50/80 backdrop-blur">
        <div className="hidden md:block">
          <div className="border-b border-slate-200/70 bg-stone-50/80 backdrop-blur">
            <div className="flex w-full items-center gap-4 px-4 py-3">
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
                <div ref={searchAnchorRefDesktop} className="relative w-full">
                  <div
                    className={[
                      "w-full overflow-hidden shadow-vilka-soft transition-colors",
                      isSearchFocused && searchSuggestions.length > 0
                        ? "rounded-t-2xl rounded-b-none border border-slate-200 bg-white"
                        : "rounded-full bg-surface-soft",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center gap-3 px-4 py-2">
                      <Search className="h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Найти ресторан или блюдо..."
                        value={searchQuery}
                        onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onFocus={() => {
                          activeSearchAnchorElRef.current = searchAnchorRefDesktop.current;
                          updateSearchAnchorRect(searchAnchorRefDesktop.current);
                          setIsSearchFocused(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setIsSearchFocused(false), 200);
                        }}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 md:flex"
                    aria-label="Чат‑бот"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
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
                            {user.phone.startsWith("tg:")
                              ? user.telegram?.username
                                ? `@${user.telegram.username}`
                                : user.telegram?.firstName || user.telegram?.lastName
                                ? `Telegram • ${(user.telegram.firstName ?? "").trim()} ${(user.telegram.lastName ?? "").trim()}`.trim()
                                : "Telegram"
                              : user.phone}
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

                {/* cart button removed from header (cart is available in sidebar) */}
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <div className="flex w-full items-center gap-3 bg-white px-3 pt-3 pb-2">
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
                        {user.phone.startsWith("tg:")
                          ? user.telegram?.username
                            ? `@${user.telegram.username}`
                            : user.telegram?.firstName || user.telegram?.lastName
                            ? `Telegram • ${(user.telegram.firstName ?? "").trim()} ${(user.telegram.lastName ?? "").trim()}`.trim()
                            : "Telegram"
                          : user.phone}
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

            {/* cart button removed from header (cart is available in sidebar) */}
          </div>

          <div className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur">
            <div className="px-3 pb-2">
              <div ref={searchAnchorRefMobile} className="relative w-full">
                <div
                  className={[
                    "w-full overflow-hidden shadow-vilka-soft transition-colors",
                    isSearchFocused && searchSuggestions.length > 0
                      ? "rounded-t-2xl rounded-b-none border border-slate-200 bg-white"
                      : "rounded-full bg-surface-soft",
                  ].join(" ")}
                >
                  <div className="flex w-full items-center gap-3 px-4 py-2">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Найти ресторан или блюдо..."
                      value={searchQuery}
                      onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      onFocus={() => {
                        activeSearchAnchorElRef.current = searchAnchorRefMobile.current;
                        updateSearchAnchorRect(searchAnchorRefMobile.current);
                        setIsSearchFocused(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsSearchFocused(false), 200);
                      }}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="w-full flex-1 px-3 pt-3 pb-5 md:px-4 md:pt-4 md:pb-7">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="hidden w-full self-start rounded-3xl bg-white shadow-vilka-soft md:sticky md:top-4 md:block md:w-auto md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:border md:border-slate-100 overscroll-contain">
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
                        className={[
                          "group flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition",
                          "md:justify-center lg:justify-between",
                          "md:tooltip-icon-only",
                          isCatActive
                            ? "bg-white text-slate-900 font-semibold"
                            : "bg-white text-slate-800 hover:bg-surface-soft",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-soft text-lg md:h-10 md:w-10">
                            <CategoryEmoji code={cat.id} />
                          </span>
                          <span className="hidden min-w-0 flex-col lg:flex">
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

          <section className="flex min-w-0 flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-vilka-soft">
            {!isSearching && (
              <>
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
              </>
            )}

            {isSearching ? (
              searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center">
                  <div className="text-base font-semibold text-slate-900">Ничего такого не нашлось</div>
                  <div className="mt-2 text-sm text-slate-600">
                    Попробуйте написать иначе (можно с опечатками или на другой раскладке).
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  {/* Two separate grids in search: anonymous offers and branded offers */}
                  {searchResults.some((r) => r.offer.isAnonymous) ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Анонимные предложения</span>
                        <span className="text-[11px] text-slate-500">Подберём самый дешёвый и ближайший вариант</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {searchResults
                          .filter((r) => r.offer.isAnonymous)
                          .map((r) => {
                            const offer = r.offer;
                            const isPressed = pressedCardId === offer.id;
                            const subtitle = baseItemById.get(offer.baseItemId)?.description ?? "";
                            return (
                              <div
                                key={offer.id}
                                className={[
                                  "transform-gpu cursor-pointer select-none transition-transform duration-100 ease-out hover:-translate-y-0.5",
                                  "[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95",
                                  isPressed ? "scale-95" : "",
                                ].join(" ")}
                                onPointerDownCapture={() => setPressedCardId(offer.id)}
                                onPointerUpCapture={() =>
                                  setPressedCardId((prev) => (prev === offer.id ? null : prev))
                                }
                                onPointerCancelCapture={() =>
                                  setPressedCardId((prev) => (prev === offer.id ? null : prev))
                                }
                                onPointerLeave={() => setPressedCardId((prev) => (prev === offer.id ? null : prev))}
                              >
                                <AnonymousOfferCard
                                  name={offer.menuItemName}
                                  price={offer.price}
                                  oldPrice={offer.oldPrice}
                                  tag={offer.tag}
                                  subtitle={subtitle}
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
                    </div>
                  ) : null}

                  {searchResults.some((r) => !r.offer.isAnonymous) ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Обычные предложения</span>
                        <span className="text-[11px] text-slate-500">Заведения, которые показывают свой бренд</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {searchResults
                          .filter((r) => !r.offer.isAnonymous)
                          .map((r) => {
                            const offer = r.offer;
                            const isPressed = pressedCardId === offer.id;
                            const subtitle = baseItemById.get(offer.baseItemId)?.description ?? "";
                            return (
                              <div
                                key={offer.id}
                                className={[
                                  "transform-gpu cursor-pointer select-none transition-transform duration-100 ease-out hover:-translate-y-0.5",
                                  "[&_button]:transform-gpu [&_button]:transition-transform [&_button]:duration-100 [&_button]:ease-out [&_button]:active:scale-95",
                                  isPressed ? "scale-95" : "",
                                ].join(" ")}
                                onPointerDownCapture={() => setPressedCardId(offer.id)}
                                onPointerUpCapture={() =>
                                  setPressedCardId((prev) => (prev === offer.id ? null : prev))
                                }
                                onPointerCancelCapture={() =>
                                  setPressedCardId((prev) => (prev === offer.id ? null : prev))
                                }
                                onPointerLeave={() => setPressedCardId((prev) => (prev === offer.id ? null : prev))}
                              >
                                <BrandedOfferCard
                                  itemName={offer.menuItemName}
                                  brand={offer.brand}
                                  price={offer.price}
                                  oldPrice={offer.oldPrice}
                                  tag={offer.tag}
                                  subtitle={subtitle}
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
                    </div>
                  ) : null}
                </div>
              )
            ) : itemsForSubcategory.length > 0 ? (
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

            {!isSearching &&
              (activeItemId && currentItem ? (
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
              ) : null)}
          </section>

          <aside className="hidden w-full shrink-0 self-start lg:sticky lg:top-4 lg:block">
            <div className="flex flex-col gap-2 pb-4">
              <div className="flex h-[calc(100vh-2rem)] min-h-0 flex-col rounded-3xl border border-slate-100 bg-stone-50/95 p-4 shadow-vilka-soft">
                <h2 className="text-base font-semibold text-slate-900">Корзина</h2>

                {lastServerMessages.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    {lastServerMessages.map((m, idx) => (
                      <div key={idx}>{m}</div>
                    ))}
                  </div>
                )}

                {totals.totalCount === 0 ? (
                  <div className="mt-3 text-xs text-slate-600">
                    В вашей корзине пока пусто. Добавляйте блюда с карточек справа, чтобы увидеть итог по заказу.
                  </div>
                ) : (
                  <>
                    {/* hard divider above items list */}
                    <div className="mt-3 h-px bg-slate-200/80" />
                    {/* Scroll happens only inside the items list */}
                    <div className="relative mt-3 min-h-0 flex-1">
                      <div
                        className="h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-2"
                        style={{
                          WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) calc(100% - 34px), transparent 100%)",
                          maskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) calc(100% - 34px), transparent 100%)",
                        }}
                      >
                        {entries.map(({ offer, quantity, lineTotal, lineOldPrice }) => {
                          const isSoldOut =
                            (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;
                          const base = baseItems.find((i) => i.id === offer.baseItemId);
                          return (
                            <div
                              key={offer.id}
                              className="group relative flex items-start gap-4 rounded-3xl bg-white p-3"
                            >
                              <button
                                type="button"
                                onClick={() => removeLine(offer.id)}
                                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Удалить"
                                title="Удалить"
                              >
                                <span className="text-xl leading-none">×</span>
                              </button>

                              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface-soft">
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

                              <div className="min-w-0 flex-1 pr-10">
                                <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                                  {offer.menuItemName}
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-3 py-1.5">
                                    <button
                                      type="button"
                                      className="flex h-4 w-4 items-center justify-center text-slate-600 disabled:opacity-40"
                                      onClick={() => remove(offer.id)}
                                      aria-label="Уменьшить количество"
                                      disabled={quantity <= 0}
                                    >
                                      <span className="text-xl leading-none">−</span>
                                    </button>
                                    <span className="min-w-[18px] text-center text-sm font-semibold text-slate-800 tabular-nums">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      className="flex h-4 w-4 items-center justify-center text-slate-600 disabled:opacity-40"
                                      onClick={() => handleAddToCart(offer.id)}
                                      aria-label="Увеличить количество"
                                      disabled={isSoldOut}
                                    >
                                      <span className="text-xl leading-none">+</span>
                                    </button>
                                  </div>

                                  <div className="flex max-w-[120px] flex-col items-end gap-0.5 text-right">
                                    {lineOldPrice ? (
                                      <div className="whitespace-nowrap text-xs font-semibold text-slate-300 line-through tabular-nums">
                                        {formatMoney.format(lineOldPrice)}
                                      </div>
                                    ) : (
                                      <div className="h-4" />
                                    )}
                                    <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-slate-900 tabular-nums">
                                      {formatMoney.format(lineTotal)}{"\u00A0"}₽
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* fog overlay (helps the fade look more like "mist") */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-stone-50/95 to-transparent" />
                    </div>

                    <div className="relative mt-4 pt-4">
                      <button
                        type="button"
                        className="vilka-btn-primary inline-flex w-full flex-nowrap items-center justify-center gap-2 whitespace-nowrap rounded-[28px] px-6 py-5 text-base font-semibold shadow-lg shadow-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98] transform-gpu"
                      >
                        <span>Продолжить</span>
                        <span className="opacity-90">·</span>
                        <span className="tabular-nums">{formatMoney.format(totals.totalPrice)}{"\u00A0"}₽</span>
                        {cartOldTotal > totals.totalPrice ? (
                          <span className="tabular-nums text-sm font-medium text-white/70 line-through">
                            {formatMoney.format(cartOldTotal)}{"\u00A0"}₽
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="shrink-0 border-t border-slate-200/70 bg-stone-50/80">
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
        onSuccess={async () => {
          // После успешного входа загружаем информацию о пользователе
          try {
            const res = await fetch("/api/auth/me");
            const data = await res.json().catch(() => ({}));
            setUser((data as any).user ?? null);

            // IMPORTANT: подтягиваем серверную корзину под новым auth (иначе пустая локальная может затереть user-cart)
            await reloadCart();

            if ((data as any).user && pendingAddOfferId != null) {
              add(pendingAddOfferId);
              setPendingAddOfferId(null);
              setIsAuthOpen(false);
            }
          } catch (err) {
            console.error("Failed to load user:", err);
          }
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
