"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MapPin, User, Search, MessageCircle, X } from "lucide-react";
import ProfileDrawer from "@/components/ProfileDrawer";

import AuthModal from "@/components/AuthModal";
import AddressModal from "@/components/AddressModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import CheckoutModal from "@/components/checkout/CheckoutModal";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import { MenuOptionButton } from "@/components/MenuOptionButton";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import { buildCatalogIndexes } from "@/modules/catalog/indexes";
import { ensureValidSelection, type Selection } from "@/modules/catalog/selection";
import type { BaseItemId, CatalogData, CategoryId, SubcategoryId } from "@/modules/catalog/types";
import { normalizeRu, normalizeAndTokenizeRu } from "@/lib/search/normalizeRu";
import { buildQueryVariants } from "@/lib/search/keyboardLayout";
import { isSimilar } from "@/lib/search/levenshtein";
import { haversineKm } from "@/lib/geo/haversineKm";

type CatalogPageClientProps = {
  catalog: CatalogData;
};

type CatalogIndexes = ReturnType<typeof buildCatalogIndexes>;

function getInitialSelection(_: CatalogData): Selection {
  return {
    categoryId: null,
    subcategoryId: null,
    itemId: null,
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

type CategoryTheme = { from: string; to: string };

function getCategoryTheme(cat: { id: string; name: string }): CategoryTheme {
  const id = (cat.id ?? "").toLowerCase();
  const name = (cat.name ?? "").toLowerCase();
  const has = (s: string) => id.includes(s) || name.includes(s);

  if (has("bakery") || has("выпеч") || has("пекар") || has("bread") || has("булоч") || has("круас")) {
    return { from: "from-[#ffe1bf]", to: "to-[#f2b37a]" };
  }
  if (has("pizza") || has("пицц")) {
    return { from: "from-[#ffd6d6]", to: "to-[#ffb2b2]" };
  }
  if (has("meat") || has("мяс") || has("говя") || has("свин") || has("кур") || has("птиц") || has("шашл")) {
    return { from: "from-[#ffd0d6]", to: "to-[#ff9cab]" };
  }
  if (has("seafood") || has("fish") || has("морепр") || has("рыб") || has("икр")) {
    return { from: "from-[#d8f1ff]", to: "to-[#a8ddff]" };
  }
  if (has("drinks") || has("water") || has("напит") || has("вода") || has("чай") || has("кофе")) {
    return { from: "from-[#d6f3ff]", to: "to-[#bfe6fb]" };
  }
  if (has("salads") || has("vegan") || has("veget") || has("овощ") || has("фрукт") || has("салат") || has("зел")) {
    return { from: "from-[#dff5c9]", to: "to-[#bfe59a]" };
  }
  if (has("desserts") || has("sweet") || has("десерт") || has("торт") || has("пирож") || has("слад")) {
    return { from: "from-[#ffd8e8]", to: "to-[#ffc0d7]" };
  }

  return { from: "from-[#f8e6b6]", to: "to-[#f1d59c]" };
}

function CatalogUI({ catalog }: CatalogPageClientProps) {
  const pathname = usePathname();
  const { quantities, entries, totals, offerStocks, add, remove, removeLine, reload: reloadCart, lastServerMessages } =
    useCart();

  const headerRef = useRef<HTMLElement | null>(null);
  const pageScrollRef = useRef<HTMLDivElement | null>(null);
  const categoriesScrollRef = useRef<HTMLElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
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
  const [searchAnchorRect, setSearchAnchorRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  type SelectedAddress = {
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
  };
  const SELECTED_ADDRESS_ID_KEY = "vilka_selected_address_id";
  const SELECTED_ADDRESS_LABEL_KEY = "vilka_selected_address_label";
  const [currentAddress, setCurrentAddress] = useState<SelectedAddress | null>(null);
  const [currentAddressLabelFallback, setCurrentAddressLabelFallback] = useState<string>(() => {
    if (typeof window === "undefined") return "Указать адрес доставки";
    try {
      const v = localStorage.getItem(SELECTED_ADDRESS_LABEL_KEY);
      return v && v.trim() ? v : "Указать адрес доставки";
    } catch {
      return "Указать адрес доставки";
    }
  });
  const currentAddressLabel = currentAddress?.label ?? currentAddressLabelFallback ?? "Указать адрес доставки";
  const [user, setUser] = useState<{
    id: number;
    phone: string;
    role: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null>(null);

  // Filter restaurants by distance to the selected user address.
  // NOTE: Requirement phrasing is ambiguous ("не меньше 5,3 км").
  // Implemented as "within 5.3 km" (<= 5.3). If you need >= 5.3, flip the comparison.
  const MAX_RESTAURANT_DISTANCE_KM = 5.3;
  const allowedRestaurantIds = useMemo(() => {
    if (!currentAddress) return null;
    const lat = currentAddress.latitude;
    const lon = currentAddress.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const allowed = new Set<number>();
    for (const r of catalog.restaurants ?? []) {
      if (r.latitude == null || r.longitude == null) continue;
      const d = haversineKm(lat, lon, r.latitude, r.longitude);
      if (d <= MAX_RESTAURANT_DISTANCE_KM) allowed.add(r.id);
    }
    return allowed;
  }, [catalog.restaurants, currentAddress]);

  const effectiveCatalog: CatalogData = useMemo(() => {
    if (!allowedRestaurantIds) return catalog;

    const offers = catalog.offers.filter((o) => allowedRestaurantIds.has(o.restaurantId));
    const baseItemIds = new Set<string>(offers.map((o) => o.baseItemId));
    const baseItems = catalog.baseItems.filter((b) => baseItemIds.has(b.id));
    const subcategoryIds = new Set<string>(baseItems.map((b) => b.subcategoryId));
    const subcategories = catalog.subcategories.filter((s) => subcategoryIds.has(s.id));
    const categoryIds = new Set<string>(subcategories.map((s) => s.categoryId));
    const categories = catalog.categories.filter((c) => categoryIds.has(c.id));
    const restaurants = catalog.restaurants.filter((r) => allowedRestaurantIds.has(r.id));

    return { ...catalog, offers, baseItems, subcategories, categories, restaurants };
  }, [allowedRestaurantIds, catalog]);

  const indexes = useMemo(() => buildCatalogIndexes(effectiveCatalog), [effectiveCatalog]);

  const [pendingAddOfferId, setPendingAddOfferId] = useState<string | null>(null);

  // drawer state (replaces dropdown)
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // card press animation
  const [pressedCardId, setPressedCardId] = useState<string | number | null>(null);

  const initial = useMemo(() => getInitialSelection(catalog), [catalog]);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | null>(initial.categoryId);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<SubcategoryId | null>(initial.subcategoryId);
  const [activeItemId, setActiveItemId] = useState<BaseItemId | null>(initial.itemId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<CategoryId[]>(initial.categoryId ? [initial.categoryId] : []);

  const { categories, subcategories, baseItems } = effectiveCatalog;

  const searchIndex = useMemo(() => {
    const idx = new Map<string, OfferTitleIndexEntry>();
    for (const offer of effectiveCatalog.offers) {
      const title = offer.menuItemName ?? "";
      idx.set(offer.id, {
        offer,
        normalizedTitle: normalizeRu(title),
        titleTokens: normalizeAndTokenizeRu(title),
      });
    }
    return idx;
  }, [effectiveCatalog.offers]);

  const baseItemById = useMemo(() => new Map(baseItems.map((b) => [b.id, b])), [baseItems]);

  const subcategoryHeroImageById = useMemo(() => {
    const map = new Map<SubcategoryId, string>();
    for (const sub of subcategories) {
      const items = indexes.itemsBySubcategory.get(sub.id) ?? [];
      let found: string | null = null;
      for (const item of items) {
        const offers = indexes.offersByBaseItem.get(item.id) ?? [];
        const withImg = offers.find((o) => !!o.imageUrl);
        if (withImg?.imageUrl) {
          found = withImg.imageUrl;
          break;
        }
      }
      if (found) map.set(sub.id, found);
    }
    return map;
  }, [indexes.itemsBySubcategory, indexes.offersByBaseItem, subcategories]);

  useEffect(() => {
    const next = ensureValidSelection(
      { categoryId: activeCategoryId, subcategoryId: activeSubcategoryId, itemId: activeItemId },
      indexes
    );
    if (next.subcategoryId !== activeSubcategoryId) setActiveSubcategoryId(next.subcategoryId);
    if (next.itemId !== activeItemId) setActiveItemId(next.itemId);
  }, [activeCategoryId, activeSubcategoryId, activeItemId, indexes]);

  const isSearching = searchQuery.trim().length >= 2;
  const manualSubcategoryHeroById = useMemo(
    () =>
      new Map<string, string>([
        ["asian_wok_fusion:asian.wok.noodles", "/wok-lapsha.jpg"],
        ["brunch_tapas:brunch.tostadas", "/toasts.jpg"],
        ["burgers_streetfood:burgers.classic", "/burgers.png"],
        ["burgers_streetfood:burgers.street", "/street-food.png"],
        ["bakery:bakery.breads", "/bread.png"],
        ["hot_dishes:hot.meat", "/meat.png"],
        ["desserts:desserts.glass", "/desserts-glass.png"],
        ["desserts:desserts.cakes", "/cakes.png"],
        ["drinks:drinks.coffee", "/coffee.png"],
        ["drinks:drinks.cold", "/cold-drinks.png"],
        ["pasta_noodles:pasta.italian", "/pasta.png"],
        ["pasta_noodles:pasta.rice", "/rice.png"],
        ["pizza:pizza.classic", "/pizza-classic.png"],
        ["pizza:pizza.mini", "/pizza-mini.png"],
        ["bowls_protein:bowls.protein.chicken", "/protein-bowl.png"],
        ["salads_bowls:salads.bowls", "/bowls.png"],
        ["salads_bowls:salads.classic", "/salads.png"],
        ["desserts.modern:desserts.modern.mousse", "/mousse.png"],
        ["soups:soups.asian", "/asian-soups.png"],
      ]),
    []
  );
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

  useEffect(() => {
    if (!isSearchFocused) return;
    const handler = () => updateSearchAnchorRect(activeSearchAnchorElRef.current);
    handler();
    window.addEventListener("resize", handler);
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

  const scoreTitleEntry = (
    entry: OfferTitleIndexEntry,
    queryTokens: string[],
    normalizedQuery: string,
    allowFuzzy: boolean
  ): { score: number; matchedAll: boolean } => {
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
      if (bestScore >= 3) merged.set(entry.offer.id, { offer: entry.offer, score: bestScore });
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
    setExpandedCategoryIds((prev) => (prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]));
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    clearSearch();
    setActiveCategoryId(categoryId);
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
    setActiveItemId(null);
    setExpandedCategoryIds((prev) => (prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]));
  };

  const handleSubcategoryCardClick = (subcategoryId: SubcategoryId) => {
    handleSubcategoryClick(subcategoryId);
    pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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

  const itemsForSubcategory = useMemo(
    () => (activeSubcategoryId ? indexes.itemsBySubcategory.get(activeSubcategoryId) ?? [] : []),
    [activeSubcategoryId, indexes]
  );

  const offersForItem = useMemo(
    () => (activeItemId ? indexes.offersByBaseItem.get(activeItemId) ?? [] : []),
    [activeItemId, indexes]
  );

  const formatMoney = useMemo(() => new Intl.NumberFormat("ru-RU"), []);
  const cartOldTotal = useMemo(() => entries.reduce((sum, e) => sum + (e.lineOldPrice ?? e.lineTotal), 0), [entries]);

  const currentCategory = categories.find((c) => c.id === activeCategoryId);
  const currentSubcategory = subcategories.find((s) => s.id === activeSubcategoryId);
  const currentItem = baseItems.find((i) => i.id === activeItemId);

  const breadcrumbLinkClasses = "cursor-pointer text-slate-500 hover:text-slate-800 hover:underline underline-offset-4";
  const breadcrumbActiveClasses = "font-medium text-slate-800";

  const isOverviewMode = !isSearching && activeSubcategoryId == null && activeItemId == null;
  const overviewCategories = activeCategoryId ? categories.filter((c) => c.id === activeCategoryId) : categories;

  const resetToOverview = () => {
    clearSearch();
    setActiveCategoryId(null);
    setActiveSubcategoryId(null);
    setActiveItemId(null);
    setExpandedCategoryIds([]);
    pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      resetToOverview();
    }
  };

  const renderOffersBlock = (baseItem: (typeof baseItems)[number], offers: typeof offersForItem) => {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">Предложения</span>
          <span className="text-[11px] text-slate-500">Из заведений рядом</span>
        </div>

        {offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
            Пока нет предложений для этой позиции.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => {
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
    );
  };

  // load user
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

  // Load current address from DB (default / last selected) and persist selection.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/addresses");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { addresses?: SelectedAddress[] };
        const list = Array.isArray(data.addresses) ? data.addresses : [];
        if (cancelled) return;

        const storedIdRaw = localStorage.getItem(SELECTED_ADDRESS_ID_KEY);
        const storedId = storedIdRaw ? Number(storedIdRaw) : NaN;
        const byStored = Number.isFinite(storedId) ? list.find((a) => a.id === storedId) : null;
        const byDefault = list.find((a) => a.is_default) ?? null;
        const next = byStored ?? byDefault ?? (list[0] ?? null);

        if (next) {
          setCurrentAddress(next);
          localStorage.setItem(SELECTED_ADDRESS_ID_KEY, String(next.id));
          localStorage.setItem(SELECTED_ADDRESS_LABEL_KEY, String(next.label));
          setCurrentAddressLabelFallback(next.label);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistAndSetCurrentAddress = (address: SelectedAddress) => {
    setCurrentAddress(address);
    try {
      localStorage.setItem(SELECTED_ADDRESS_ID_KEY, String(address.id));
      localStorage.setItem(SELECTED_ADDRESS_LABEL_KEY, String(address.label));
    } catch {}
    setCurrentAddressLabelFallback(address.label);
  };

  const isSelectedAddress = (v: unknown): v is SelectedAddress => {
    if (typeof v !== "object" || v == null || Array.isArray(v)) return false;
    const r = v as Record<string, unknown>;
    return (
      typeof r.id === "number" &&
      typeof r.label === "string" &&
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      typeof r.city === "string"
    );
  };

  // synced wheel scroll
  useEffect(() => {
    const pageEl = pageScrollRef.current;
    if (!pageEl) return;

    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaY) < 0.5) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-no-sync-wheel='true']")) return;

      e.preventDefault();
      const delta = e.deltaY;

      pageEl.scrollTop += delta;

      const catEl = categoriesScrollRef.current;
      if (catEl) catEl.scrollTop += delta;
    };

    pageEl.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => pageEl.removeEventListener("wheel", handler, true);
  }, []);
  useEffect(() => {
    console.log("=== SUBCATEGORIES ===");
    console.table(
      subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
      }))
    );
  
    console.log("=== CATEGORIES ===");
    console.table(
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
      }))
    );
  
    console.log("=== BASE ITEMS ===");
    console.table(
      baseItems.map((item) => ({
        id: item.id,
        name: item.name,
        subcategoryId: item.subcategoryId,
        categoryId: item.categoryId,
      }))
    );
  }, [categories, subcategories, baseItems]);
  // header height var
  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const apply = () => {
      const h = Math.ceil(headerEl.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--vilka-header-h", `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(headerEl);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  const isOutOfDeliveryZone =
    Boolean(currentAddress) && allowedRestaurantIds != null && effectiveCatalog.offers.length === 0;

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--vilka-bg)]">
      {isSearchFocused && (
        <div className="fixed inset-0 z-30 bg-black/45" onMouseDown={() => setIsSearchFocused(false)} aria-hidden="true" />
      )}

      {isSearchFocused && searchSuggestions.length > 0 && searchAnchorRect && (
        <div className="fixed z-50" style={{ left: searchAnchorRect.left, top: searchAnchorRect.top, width: searchAnchorRect.width }}>
          <div className="rounded-b-2xl border border-slate-200 border-t-0 bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
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

<header ref={headerRef} className="sticky top-0 z-40 bg-transparent">
  {/* ===== DESKTOP ===== */}
  <div className="hidden md:block">
    {/* Полоса шапки НА ВСЮ ШИРИНУ, без отступа сверху, скругление только снизу */}
    <div className="mx-auto w-[calc(100%-24px)] rounded-b-[28px] bg-white/95 shadow-vilka-soft ring-1 ring-black/5 backdrop-blur md:w-[calc(100%-32px)]">

      {/* Контент центрируем, но сама шапка длинная */}
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-6 py-3">
        {/* logo */}
        <Link
          href="/"
          onClick={handleLogoClick}
          className="flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-slate-50"
        >
          <div className="relative h-12 w-12 shrink-0">
            <Image src="/logo.png" alt="Вилка" fill priority sizes="48px" className="object-contain" />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold text-slate-900">Вилка</span>
            <span className="hidden lg:block text-xs text-slate-500">Еда из ресторанов и пекарен</span>
          </div>
        </Link>

        {/* search (как у Самоката: серый “пилюля”, без явной рамки) */}
        <div className="flex-1">
          <div ref={searchAnchorRefDesktop} className="relative w-full">
            <div
              className={[
                "flex w-full items-center gap-3 rounded-full px-4 py-2.5",
                "bg-slate-100/80",
                "ring-1 ring-transparent",
                "focus-within:ring-2 focus-within:ring-emerald-500/40",
                isSearchFocused && searchSuggestions.length > 0 ? "rounded-b-none" : "",
              ].join(" ")}
            >
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Найти ресторан или блюдо..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  activeSearchAnchorElRef.current = searchAnchorRefDesktop.current;
                  updateSearchAnchorRect(searchAnchorRefDesktop.current);
                  setIsSearchFocused(true);
                }}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />

              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                  aria-label="Очистить поиск"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* right actions (тоже “пилюли” как у Самоката) */}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200"
              aria-label="Чат-бот"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}

          {user && (
            <button
              type="button"
              onClick={() => setIsAddressOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-100/80 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <MapPin className="h-4 w-4 text-slate-600" />
              <span className="max-w-[240px] truncate">{currentAddressLabel}</span>
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-100/80 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <User className="h-4 w-4 text-slate-600" />
              <span>Профиль</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-100/80 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <User className="h-4 w-4 text-slate-600" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>
    </div>
  </div>

  {/* ===== MOBILE ===== */}
  <div className="md:hidden">
  <div className="mx-auto w-[calc(100%-20px)] rounded-b-[24px] bg-white/95 shadow-vilka-soft ring-1 ring-black/5 backdrop-blur">

      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2">
          <div className="relative h-11 w-11 shrink-0">
            <Image src="/logo.png" alt="Вилка" fill priority sizes="44px" className="object-contain" />
          </div>
        </Link>

        {user && (
          <button
            type="button"
            onClick={() => setIsAddressOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100/80 px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-200"
          >
            <MapPin className="h-4 w-4 text-slate-600" />
            <span className="truncate">{currentAddressLabel}</span>
          </button>
        )}

        {user ? (
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200"
            aria-label="Профиль"
          >
            <User className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200"
            aria-label="Войти"
          >
            <User className="h-4 w-4" />
          </button>
        )}

        {user && (
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200"
            aria-label="Чат-бот"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        <div ref={searchAnchorRefMobile} className="relative w-full">
          <div
            className={[
              "flex w-full items-center gap-3 rounded-full px-4 py-2.5",
              "bg-slate-100/80",
              "ring-1 ring-transparent",
              "focus-within:ring-2 focus-within:ring-emerald-500/40",
              isSearchFocused && searchSuggestions.length > 0 ? "rounded-b-none" : "",
            ].join(" ")}
          >
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Найти ресторан или блюдо..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                activeSearchAnchorElRef.current = searchAnchorRefMobile.current;
                updateSearchAnchorRect(searchAnchorRefMobile.current);
                setIsSearchFocused(true);
              }}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={clearSearch}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
</header>




      <div ref={pageScrollRef} className="flex-1 overflow-y-auto bg-[var(--vilka-bg)]">
        <section className="w-full px-3 pt-3 pb-5 md:px-4 md:pt-4 md:pb-7">
          {isOutOfDeliveryZone ? (
            <div className="mx-auto w-full max-w-[860px] rounded-3xl bg-white p-8 shadow-vilka-soft md:p-10">
              <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
                <div className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                  Упс, похоже нет ресторанов рядом с вами
                </div>
                <div className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
                  Попробуйте указать другой адрес доставки — мы покажем рестораны, которые доставляют в вашу зону.
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressOpen(true)}
                  className="vilka-btn-primary mt-7 h-14 rounded-full px-8 text-base font-semibold"
                >
                  Изменить адрес
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
            <aside
              ref={categoriesScrollRef}
              className="hidden w-full self-start rounded-3xl bg-white shadow-vilka-soft md:sticky md:top-4 md:block md:w-auto md:max-h-[calc(100dvh-var(--vilka-header-h,0px)-2rem)] md:overflow-y-auto overscroll-contain"
            >
              <div className="rounded-3xl bg-white p-2 md:p-3">
                <h2 className="hidden px-2 pb-2 text-base font-semibold text-slate-900 lg:block">Каталог</h2>

                <nav className="flex flex-col gap-0">
                  {categories.map((cat) => {
                    const isCatActive = activeCategoryId === cat.id;
                    const isExpanded = expandedCategoryIds.includes(cat.id);
                    const subsForCat = subcategories.filter((s) => s.categoryId === cat.id);

                    return (
                      <div key={cat.id} className="mb-0">
                        <button
                          type="button"
                          onClick={() => handleCategoryClick(cat.id)}
                          title={cat.name}
                          className={[
                            "group flex w-full items-center justify-between rounded-2xl px-1 py-1 text-left transition",
                            "md:justify-center lg:justify-between",
                            "md:tooltip-icon-only",
                            isCatActive ? "bg-white text-slate-900 font-semibold" : "bg-white text-slate-800 hover:bg-surface-soft",
                          ].join(" ")}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-surface-soft text-base md:h-9 md:w-9 md:text-lg">
                              <CategoryEmoji code={cat.id} />
                            </span>
                            <span className="hidden min-w-0 flex-col lg:flex">
                              <span className="truncate text-sm leading-tight">{cat.name}</span>
                              {cat.isPromo && <span className="mt-0.5 truncate text-[10px] text-slate-500">Акции и спецпредложения</span>}
                            </span>
                          </span>
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
                                      isSubActive ? "bg-surface-soft text-slate-900 font-medium" : "bg-transparent text-slate-700 hover:bg-surface-soft",
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

            <section className="flex min-w-0 flex-col gap-3 rounded-3xl bg-white p-4 shadow-vilka-soft">
              {!isSearching && (
                <>
                  {isOverviewMode ? (
                    <div className="flex flex-col gap-8">
                      {activeCategoryId && (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={resetToOverview}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                          >
                            Все категории
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col gap-10">
                        {overviewCategories.map((cat) => {
                          const subsForCat = indexes.subcategoriesByCategory.get(cat.id) ?? [];
                          if (subsForCat.length === 0) return null;
                          const theme = getCategoryTheme(cat);

                          return (
                            <div key={cat.id} className="flex flex-col gap-6">
                              <h2 className="text-2xl font-semibold tracking-tight text-slate-800 md:text-3xl">{cat.name}</h2>

                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {subsForCat.map((sub) => {
                                 const hero =
                                 manualSubcategoryHeroById.get(sub.id) ??
                                 (sub as any).imageUrl ??
                                 subcategoryHeroImageById.get(sub.id) ??
                                 null;
                                  return (
                                    <button
  key={sub.id}
  type="button"
  onClick={() => handleSubcategoryCardClick(sub.id)}
  className={[
    "group relative w-full overflow-hidden rounded-[28px] text-left shadow-vilka-soft",
    "h-[220px] sm:h-[240px] md:h-[260px]",
    "bg-[#f3f4f6]",
    "transition-transform duration-150 ease-out hover:-translate-y-1 active:translate-y-0",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
  ].join(" ")}
  aria-label={`Открыть подкатегорию: ${sub.name}`}
>
<div className="absolute left-5 top-5 z-20 max-w-[58%]">
  <div className="text-[15px] font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:text-[17px] md:text-[18px]">
    {sub.name}
  </div>
</div>

{hero ? (
  <>
    <img
      src={hero}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 z-10 bg-gradient-to-b from-black/45 via-black/10 to-transparent"
    />
  </>
) : (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 flex h-[72%] items-end justify-center text-7xl"
    >
      <CategoryEmoji code={cat.id} />
    </div>
  )}
</button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={resetToOverview}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                        >
                          ← Каталог
                        </button>

                        {currentCategory?.name ? <span className="text-slate-500">{currentCategory.name}</span> : <span className="text-slate-500">Категория</span>}
                        <span className="text-slate-500"> · </span>

                        {currentSubcategory?.id ? (
                          activeItemId ? (
                            <button type="button" className={breadcrumbLinkClasses} onClick={() => handleSubcategoryClick(currentSubcategory.id)}>
                              {currentSubcategory.name}
                            </button>
                          ) : (
                            <span className={breadcrumbActiveClasses}>{currentSubcategory.name}</span>
                          )
                        ) : (
                          <span className={activeItemId ? "text-slate-500" : breadcrumbActiveClasses}>Подкатегория</span>
                        )}

                        {currentItem?.id && (
                          <>
                            <span className="text-slate-500"> · </span>
                            <button type="button" className="font-medium text-slate-800 hover:underline underline-offset-4" onClick={() => handleItemClick(currentItem.id)}>
                              {currentItem.name}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isSearching ? (
                searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center">
                    <div className="text-base font-semibold text-slate-900">Ничего такого не нашлось</div>
                    <div className="mt-2 text-sm text-slate-600">Попробуйте написать иначе (можно с опечатками или на другой раскладке).</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">Результаты поиска</span>
                      <span className="text-[11px] text-slate-500">{searchResults.length} шт.</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {searchResults.map((r) => {
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
                )
              ) : isOverviewMode ? null : itemsForSubcategory.length > 0 ? (
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
                !isOverviewMode &&
                (activeItemId && currentItem ? (
                  renderOffersBlock(currentItem, offersForItem)
                ) : itemsForSubcategory.length > 0 ? (
                  <div className="flex flex-col gap-10">
                    {itemsForSubcategory.map((item) => {
                      const offers = indexes.offersByBaseItem.get(item.id) ?? [];
                      if (offers.length === 0) return null;
                      return (
                        <div key={item.id} className="flex flex-col gap-6">
                          <h2 className="text-2xl font-medium text-slate-800 md:text-3xl">{item.name}</h2>
                          {renderOffersBlock(item, offers)}
                        </div>
                      );
                    })}
                  </div>
                ) : null)}
            </section>

            {/* cart */}
            <aside className="hidden w-full shrink-0 self-start lg:sticky lg:top-4 lg:block">
              <div className="flex flex-col gap-2 pb-4">
                <div className="flex h-[calc(100dvh-var(--vilka-header-h,0px)-2rem)] min-h-0 flex-col rounded-3xl bg-white p-4 shadow-vilka-soft">
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
                      <div className="mt-3 h-px bg-slate-200/80" />

                      <div className="relative mt-3 min-h-0 flex-1">
                        <div
                          data-no-sync-wheel="true"
                          className="h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-2"
                          style={{
                            WebkitMaskImage:
                              "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) calc(100% - 34px), transparent 100%)",
                            maskImage:
                              "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) calc(100% - 34px), transparent 100%)",
                          }}
                        >
                          {entries.map(({ offer, quantity, lineTotal, lineOldPrice }) => {
                            const isSoldOut = (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;

                            return (
                              <div key={offer.id} className="group relative flex items-start gap-4 rounded-3xl bg-white p-3">
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
                                    <img src={offer.imageUrl} alt={offer.menuItemName} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="px-2 text-center text-[11px] font-medium text-slate-500">пока ещё нет фото!</span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 pr-10">
                                  <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{offer.menuItemName}</div>

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
                                      <span className="min-w-[18px] text-center text-sm font-semibold text-slate-800 tabular-nums">{quantity}</span>
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

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-stone-50/95 to-transparent" />
                      </div>

                      <div className="relative mt-4 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsCheckoutOpen(true)}
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
          )}
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
      </div>

      {/* Profile drawer (no duplicated rows) */}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        currentAddressId={currentAddress?.id ?? null}
        onSelectAddress={(address) => {
          if (isSelectedAddress(address)) persistAndSetCurrentAddress(address);
        }}
      />


      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setPendingAddOfferId(null);
        }}
        onSuccess={async () => {
          try {
            const res = await fetch("/api/auth/me");
            const data = (await res.json().catch(() => ({}))) as {
              user?:
                | {
                    id: number;
                    phone: string;
                    role: string;
                    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
                  }
                | null;
            };
            setUser(data.user ?? null);

            await reloadCart();

            if (data.user && pendingAddOfferId != null) {
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
        onSelectAddress={(address) => {
          if (isSelectedAddress(address)) persistAndSetCurrentAddress(address);
        }}
      />

      <AIAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        baseItems={baseItems}
        currentAddress={currentAddress}
        onAddressSelected={(address) => {
          if (isSelectedAddress(address)) persistAndSetCurrentAddress(address);
        }}
      />
    </main>
  );
}

export default function CatalogPageClient(props: CatalogPageClientProps) {
  return (
    <CartProvider offers={props.catalog.offers}>
      <CatalogUI catalog={props.catalog} />
    </CartProvider>
  );
}
