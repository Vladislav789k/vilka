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
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchResults } from "@/components/SearchResults";
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
  const { quantities, entries, totals, offerStocks, add, remove, reload: reloadCart } = useCart();

  // Agent logging helper (dev-only, can be disabled via env var)
  // Note: All agent logging is now suppressed via fetch monkey-patch in layout.tsx
  const shouldLogAgent = () => {
    if (process.env.NODE_ENV !== "development") return false;
    if (process.env.NEXT_PUBLIC_DISABLE_AGENT_LOGS === "1") return false;
    return true;
  };

  const agentLog = (data: any) => {
    if (!shouldLogAgent()) return;
    // Agent logging is now handled via fetch monkey-patch in layout.tsx
    // This function is kept for compatibility but does nothing
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchHint, setSearchHint] = useState<string | undefined>(undefined);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchRequestSeqRef = useRef<number>(0);
  
  // Client-side query cache (30-60s TTL)
  const searchCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const SEARCH_CACHE_TTL_MS = 45 * 1000; // 45 seconds
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
  const [user, setUser] = useState<{
    id: number;
    phone: string;
    role: string;
    telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null>(null);
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

  // Improved search with backend API (debounced, with AbortController, cache, and robust error handling)
  useEffect(() => {
    const q = searchQuery.trim();
    
    // Abort previous request if still in flight
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Clear error on new query
    setSearchError(null);
    
    if (!q) {
      setSearchResults([]);
      setIsSearchResultsOpen(false);
      setIsSearching(false);
      return;
    }
    
    // Check cache first
    const cacheKey = q.toLowerCase();
    const cached = searchCacheRef.current.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < SEARCH_CACHE_TTL_MS) {
      // Cache hit - use cached data immediately
      const data = cached.data;
      const results = data.results || [];
      setSearchResults(results);
      setSearchHint(data.hint);
      setIsSearchResultsOpen(results.length > 0 || !!data.hint);
      setIsSearching(false);
      
      // Handle auto-navigation from cache
      if (data.shouldAutoNavigate && results.length === 1) {
        const result = results[0];
        const offer = catalog.offers.find((o) => o.id === String(result.id));
        if (offer) {
          const baseItem = catalog.baseItems.find((bi) => bi.id === offer.baseItemId);
          if (baseItem) {
            setActiveCategoryId(baseItem.categoryId);
            setActiveSubcategoryId(baseItem.subcategoryId);
            setActiveItemId(baseItem.id);
            setExpandedCategoryIds((prev) =>
              prev.includes(baseItem.categoryId) ? prev : [...prev, baseItem.categoryId]
            );
            setIsSearchResultsOpen(false);
            setSearchQuery("");
          }
        }
      }
      return;
    }
    
    // Increment request sequence for this new query
    searchRequestSeqRef.current += 1;
    const currentSeq = searchRequestSeqRef.current;
    
    // Debounce search (400ms for better UX)
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      void (async () => {
      // Create new AbortController for this request
      const abortController = new AbortController();
      searchAbortControllerRef.current = abortController;
      
      const isDev = process.env.NODE_ENV === "development";
      const url = `/api/search?q=${encodeURIComponent(q)}&limit=10${isDev ? "&debug=true" : ""}`;
      
      if (isDev) {
        console.log(`[search] Fetching: ${url} (seq: ${currentSeq})`);
      }
      
      // Retry logic with backoff
      const MAX_RETRIES = 2;
      const RETRY_DELAYS = [200, 400]; // ms
      
      for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
        // Check if this request is still the latest
        if (currentSeq !== searchRequestSeqRef.current) {
          if (isDev) {
            console.log(`[search] Request ${currentSeq} superseded, aborting`);
          }
          return;
        }
        
        // Check if aborted
        if (abortController.signal.aborted) {
          if (isDev) {
            console.log(`[search] Request ${currentSeq} aborted`);
          }
          return;
        }
        
        try {
          const response = await fetch(url, { signal: abortController.signal });
          
          // Check if request was aborted after fetch
          if (abortController.signal.aborted || currentSeq !== searchRequestSeqRef.current) {
            if (isDev) {
              console.log(`[search] Request ${currentSeq} aborted after fetch`);
            }
            return;
          }
          
          // Check response status
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Check again if this request is still the latest
          if (currentSeq !== searchRequestSeqRef.current) {
            if (isDev) {
              console.log(`[search] Request ${currentSeq} superseded, ignoring response`);
            }
            return;
          }
          
          if (data.error) {
            if (isDev) {
              console.error(`[search] API error (seq ${currentSeq}):`, data.error);
            }
            // Keep previous results, just show error hint
            setSearchError("Ошибка поиска. Попробуйте ещё раз.");
            setIsSearching(false);
            return;
          }
          
          // Cache the result
          searchCacheRef.current.set(cacheKey, {
            data,
            timestamp: now,
          });
          
          // Clean up old cache entries (keep only last 50)
          if (searchCacheRef.current.size > 50) {
            const entries = Array.from(searchCacheRef.current.entries());
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            searchCacheRef.current = new Map(entries.slice(0, 50));
          }
          
          const results = data.results || [];
          setSearchResults(results);
          setSearchHint(data.hint);
          setSearchError(null); // Clear any previous error
          setIsSearchResultsOpen(results.length > 0 || !!data.hint);
          
          // Auto-navigate ONLY when exactly 1 confident match exists
          if (data.shouldAutoNavigate && results.length === 1) {
            const result = results[0];
            const offer = catalog.offers.find((o) => o.id === String(result.id));
            if (offer) {
              const baseItem = catalog.baseItems.find((bi) => bi.id === offer.baseItemId);
              if (baseItem) {
                setActiveCategoryId(baseItem.categoryId);
                setActiveSubcategoryId(baseItem.subcategoryId);
                setActiveItemId(baseItem.id);
                setExpandedCategoryIds((prev) =>
                  prev.includes(baseItem.categoryId) ? prev : [...prev, baseItem.categoryId]
                );
                setIsSearchResultsOpen(false);
                setSearchQuery("");
              }
            }
          }
          
          if (isDev && data.debug) {
            console.log(`[search] Success (seq ${currentSeq}):`, data.debug);
          }
          
          // Success - exit retry loop
          setIsSearching(false);
          searchAbortControllerRef.current = null;
          return;
          
        } catch (error: any) {
          // Check if this is an abort error - ignore silently
          if (error.name === "AbortError" || abortController.signal.aborted) {
            if (isDev) {
              console.log(`[search] Request ${currentSeq} aborted (${error.name})`);
            }
            return; // Don't clear results, don't show error, just return
          }
          
          // Check if this request is still the latest
          if (currentSeq !== searchRequestSeqRef.current) {
            if (isDev) {
              console.log(`[search] Request ${currentSeq} superseded during error handling`);
            }
            return;
          }
          
          // Network error - retry if we have retries left
          const isNetworkError = error instanceof TypeError && error.message === "Failed to fetch";
          
          if (isNetworkError && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCount];
            if (isDev) {
              console.log(`[search] Network error (seq ${currentSeq}), retrying (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry
          }
          
          // Final failure or non-network error
          if (isDev) {
            console.error(`[search] Fetch error (seq ${currentSeq}):`, error);
          }
          
          // Keep previous results, show error hint
          setSearchError("Ошибка сети. Попробуйте ещё раз.");
          setIsSearching(false);
          searchAbortControllerRef.current = null;
          return;
        }
      }
      })().catch((err) => {
        // Silently catch any unhandled promise rejections
        if (process.env.NODE_ENV === "development") {
          console.debug("[search] Unhandled error in search effect:", err);
        }
        // Keep previous results, just show error hint
        setSearchError("Ошибка поиска. Попробуйте ещё раз.");
        setIsSearching(false);
      });
    }, 400); // 400ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
    };
  }, [searchQuery, catalog]);

  // Close search results on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        isSearchResultsOpen &&
        !target.closest('[data-search-results]') &&
        !target.closest('[data-search-input]')
      ) {
        setIsSearchResultsOpen(false);
      }
    };

    if (isSearchResultsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isSearchResultsOpen]);

  // Close search results when route changes (item selected)
  useEffect(() => {
    if (activeItemId) {
      setIsSearchResultsOpen(false);
    }
  }, [activeItemId]);

  // Helper functions to map menu_item_id to catalog IDs
  const getItemId = (menuItemId: number): BaseItemId | null => {
    const offer = catalog.offers.find((o) => o.id === String(menuItemId));
    return offer?.baseItemId || null;
  };

  const getCategoryId = (menuItemId: number): CategoryId | null => {
    const baseItemId = getItemId(menuItemId);
    if (!baseItemId) return null;
    const baseItem = catalog.baseItems.find((bi) => bi.id === baseItemId);
    return baseItem?.categoryId || null;
  };

  const getSubcategoryId = (menuItemId: number): SubcategoryId | null => {
    const baseItemId = getItemId(menuItemId);
    if (!baseItemId) return null;
    const baseItem = catalog.baseItems.find((bi) => bi.id === baseItemId);
    return baseItem?.subcategoryId || null;
  };

  const handleSearchResultSelect = (itemId: BaseItemId, categoryId: CategoryId, subcategoryId: SubcategoryId) => {
    setActiveCategoryId(categoryId);
    setActiveSubcategoryId(subcategoryId);
    setActiveItemId(itemId);
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev : [...prev, categoryId]
    );
    setIsSearchResultsOpen(false);
    setSearchQuery("");
  };

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
    "cursor-pointer text-foreground-muted hover:text-foreground hover:underline underline-offset-4";
  const breadcrumbActiveClasses = "font-medium text-foreground";

  const renderOffersBlock = (baseItem: (typeof baseItems)[number], offers: typeof offersForItem) => {
    const anon = offers.find((o) => o.isAnonymous);
    const branded = offers.filter((o) => !o.isAnonymous);

    return (
      <>
        {/* Секция анонимных предложений */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Анонимные предложения</span>
            <span className="text-[11px] text-foreground-muted">Подберём самый дешёвый и ближайший вариант</span>
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
            <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-xs text-foreground-muted dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
              Для этой позиции пока нет анонимных предложений.
            </div>
          )}
        </div>

        {/* Секция брендовых предложений */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Из заведений рядом</span>
            <span className="text-[11px] text-foreground-muted">Заведения, которые показывают свой бренд</span>
          </div>

          {branded.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-xs text-foreground-muted dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
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
        const res = await fetch("/api/auth/me", {
          credentials: "include", // Ensure cookies are sent
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        // Silently ignore errors - user might not be logged in
        if (process.env.NODE_ENV === "development") {
          console.debug("[CatalogUI] Failed to load user:", err);
        }
      }
    };
    void loadUser().catch(() => {
      // Silently ignore unhandled promise rejections
    });
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
    <main className="flex h-screen flex-col overflow-hidden bg-transparent transition-colors dark:bg-background">
      <header className="shrink-0 z-40 border-b border-border bg-card dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
        <div className="hidden md:block">
          <div className="bg-card dark:bg-white/10 dark:backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-3">
              <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                  <span className="text-lg font-bold text-brand-dark">V</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-semibold text-foreground">Вилка</span>
                  <span className="text-xs text-foreground-muted">Еда из ресторанов и пекарен</span>
                </div>
              </Link>

              <div className="hidden flex-1 items-center md:flex">
                <div className="relative flex w-full items-center gap-3 rounded-full bg-card border border-border px-4 py-2 shadow-vilka-soft dark:bg-white/10 dark:backdrop-blur-md dark:shadow-lg dark:border-white/10">
                  <Search className="h-4 w-4 text-foreground-muted" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Найти ресторан или блюдо..."
                    value={searchQuery}
                    onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setIsSearchResultsOpen(true);
                      }
                    }}
                    className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-foreground-muted"
                    data-search-input
                  />
                  {isSearching && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                  )}
                  {isSearchResultsOpen && (
                    <div data-search-results>
                      <SearchResults
                        results={searchResults}
                        query={searchQuery}
                        hint={searchHint}
                        error={searchError}
                        onClose={() => setIsSearchResultsOpen(false)}
                        onSelectItem={handleSearchResultSelect}
                        getItemId={getItemId}
                        getCategoryId={getCategoryId}
                        getSubcategoryId={getSubcategoryId}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20 md:flex"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Чат‑бот</span>
                  </button>
                )}
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAddressOpen(true)}
                    className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20 md:flex"
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
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Профиль</span>
                      <svg className={`h-3 w-3 transition-transform ${isProfileDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-300 bg-slate-800 shadow-lg dark:border-white/20 dark:bg-slate-800">
                        <div className="p-2">
                          <div className="px-3 py-2 text-xs text-white">
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
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
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
                    className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20 md:flex"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Войти</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMiniCartOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-bold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>
                      {cartCountLabel} • {cartButtonLabel}
                    </span>
                  </button>

                  {isMiniCartOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-border bg-card p-3 shadow-lg dark:border-white/20 dark:bg-slate-800">
                      <div className="flex items-center justify-between text-base font-bold text-slate-900 dark:text-white">
                        <span>Корзина</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-800 underline hover:text-slate-900 dark:text-white dark:hover:text-slate-200"
                          onClick={() => setIsMiniCartOpen(false)}
                        >
                          Закрыть
                        </button>
                      </div>

                      <div className="mt-2 max-h-60 space-y-2 overflow-auto">
                        {entries.length === 0 ? (
                          <div className="text-xs font-medium text-slate-700 dark:text-white">В корзине пока пусто</div>
                        ) : (
                          entries.map(({ offer, quantity }) => {
                            const isSoldOut =
                              (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;
                            return (
                            <div
                              key={offer.id}
                              className="flex items-center justify-between rounded-xl bg-white border border-border px-2 py-2 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-white">
                                  {offer.menuItemName}
                                </div>
                                <div className="text-[11px] font-medium text-slate-700 dark:text-white">
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

                      <div className="mt-3 flex items-center justify-between text-base font-bold text-slate-900 dark:text-white">
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
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 bg-transparent px-4 pt-3 pb-2 dark:bg-background">
            <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
                <span className="text-base font-bold text-brand-dark">V</span>
              </div>
            </Link>

            {user && (
              <button
                type="button"
                onClick={() => setIsAddressOpen(true)}
                className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
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
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
                >
                  <User className="h-4 w-4" />
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-300 bg-slate-800 shadow-lg dark:border-white/20 dark:bg-slate-800">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs text-white">
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
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
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
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setIsAssistantOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50"
                title="Чат‑бот"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}

            <button className="flex h-8 items-center justify-center rounded-full bg-brand px-3 text-[11px] font-semibold text-white shadow-md shadow-brand/30 hover:bg-brand-dark">
              {cartButtonLabel}
            </button>
          </div>

          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur dark:bg-white/10 dark:backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 pb-2">
              <div className="relative flex w-full items-center gap-3 rounded-full bg-card border border-border px-4 py-2 shadow-vilka-soft dark:bg-white/10 dark:border-white/10">
                <Search className="h-4 w-4 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Найти ресторан или блюдо..."
                  value={searchQuery}
                  onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setIsSearchResultsOpen(true);
                    }
                  }}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-muted"
                />
                {isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                )}
                {isSearchResultsOpen && (
                  <div data-search-results>
                    <SearchResults
                      results={searchResults}
                      query={searchQuery}
                      hint={searchHint}
                      onClose={() => setIsSearchResultsOpen(false)}
                      onSelectItem={handleSearchResultSelect}
                      getItemId={getItemId}
                      getCategoryId={getCategoryId}
                      getSubcategoryId={getSubcategoryId}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 pt-4 md:pt-6">
        <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside
            ref={(el: HTMLElement | null) => {
              if (el && shouldLogAgent()) {
                try {
                  const width = window.getComputedStyle(el).width;
                  const display = window.getComputedStyle(el).display;
                  const firstBtn = el.querySelector("button");
                  const btnTextVisible = firstBtn
                    ? window.getComputedStyle(firstBtn.querySelector('span[class*="hidden"]') as Element).display !==
                      "none"
                    : false;
                  agentLog({
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
                  });
                } catch {
                  // Silently ignore
                }
              }
            }}
            className="hidden h-full w-full overflow-y-auto rounded-3xl bg-card shadow-vilka-soft dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10 md:block md:w-auto md:border md:border-border"
          >
            <div className="rounded-3xl bg-card p-2 dark:bg-transparent md:p-3">
              <h2 className="hidden px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted lg:block">
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
                          if (shouldLogAgent()) {
                            try {
                              const el = e.currentTarget;
                              const tooltipEl = window.getComputedStyle(el, "::after");
                              const tooltipOpacity = tooltipEl.opacity;
                              const viewportWidth = window.innerWidth;
                              agentLog({
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
                              });
                            } catch {
                              // Silently ignore
                            }
                          }
                        }}
                        className={[
                          "group flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition",
                          "md:justify-center lg:justify-between",
                          "md:tooltip-icon-only",
                          isCatActive
                            ? "bg-card text-foreground border border-border font-bold shadow-sm dark:bg-white/20 dark:border-white/10"
                            : "bg-card text-foreground border border-border font-medium shadow-sm hover:bg-hover hover:border-border dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/10",
                        ].join(" ")}
                      >
                          <span
                            ref={(el: HTMLElement | null) => {
                              if (el && shouldLogAgent()) {
                                try {
                                  const justifyContent = window.getComputedStyle(el).justifyContent;
                                  const viewportWidth = window.innerWidth;
                                  agentLog({
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
                                  });
                                } catch {
                                  // Silently ignore
                                }
                              }
                            }}
                          className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted border border-border shadow-sm text-lg md:h-10 md:w-10 dark:bg-white/10 dark:border-white/10">
                            <CategoryEmoji code={cat.id} />
                          </span>
                          <span
                            ref={(el: HTMLElement | null) => {
                              if (el && shouldLogAgent()) {
                                try {
                                  const display = window.getComputedStyle(el).display;
                                  const width = window.getComputedStyle(el).width;
                                  const textEl = el.querySelector("span");
                                  const textWidth = textEl ? window.getComputedStyle(textEl).width : "unknown";
                                  const textOverflow = textEl ? window.getComputedStyle(textEl).textOverflow : "unknown";
                                  agentLog({
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
                                  });
                                } catch {
                                  // Silently ignore
                                }
                              }
                            }}
                            className="hidden min-w-0 flex-col lg:flex"
                          >
                            <span className="truncate text-sm leading-tight">{cat.name}</span>
                            {cat.isPromo && (
                              <span className="mt-0.5 truncate text-[10px] text-foreground-muted">
                                Акции и спецпредложения
                              </span>
                            )}
                          </span>
                        </span>

                        <ChevronRight
                          className={[
                            "hidden h-4 w-4 shrink-0 text-foreground-muted transition-transform lg:block",
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
                                      ? "bg-muted text-foreground font-semibold dark:bg-white/20"
                                      : "bg-transparent text-foreground font-medium hover:bg-hover dark:hover:bg-white/10",
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

          <section className="flex min-w-0 flex-1 min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-vilka-soft dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
            {/* Информационный блок */}
            <div className="rounded-[var(--vilka-radius-xl)] border border-border bg-card p-5 sm:p-6 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-md">
                  <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-xs font-medium text-foreground shadow-sm dark:bg-white/10 dark:border-white/10">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Горячая еда за 25–35 минут</span>
                  </div>
                  <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
                    Рестораны и пекарни
                    <br />
                    в одной доставке.
                  </h1>
                  <p className="mt-2 text-sm text-foreground-muted">
                    Заведения размещают свои блюда в Вилке и могут скрыть бренд. Вы выбираете — анонимное
                    предложение или конкретный ресторан рядом.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-3xl bg-white border border-border p-4 text-sm sm:w-64 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">Минимальная сумма заказа</span>
                    <span className="text-sm font-semibold text-foreground">от 0 ₽</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">Доставка из заведений</span>
                    <span className="text-sm font-semibold text-foreground">от 0 ₽</span>
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
                  <span className="text-foreground-muted">{currentCategory.name}</span>
                ) : (
                  <span className="text-foreground-muted">Категория</span>
                )}

                <span className="text-foreground-muted"> · </span>

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
                  <span className={activeItemId ? "text-foreground-muted" : breadcrumbActiveClasses}>Подкатегория</span>
                )}

                {/* Level 3: show only when selected */}
                {currentItem?.id && (
                  <>
                    <span className="text-foreground-muted"> · </span>
                    <button
                      type="button"
                      className="font-medium text-foreground-muted hover:underline underline-offset-4"
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
                <div className="text-xs text-foreground-muted">Загрузка блюд…</div>
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
                        <h2 className="text-4xl font-bold text-foreground">{item.name}</h2>
                        {renderOffersBlock(item, offers)}
                      </div>
                    );
                  })}
                </div>
              ) : null}
          </section>

          <aside className="hidden h-full w-full shrink-0 overflow-y-auto lg:block">
            <div className="flex h-full flex-col gap-3 pb-6">
              <div className="flex flex-1 flex-col rounded-3xl border border-border bg-card p-4 shadow-vilka-soft dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
                <h2 className="text-base font-semibold text-foreground">Доставка 15 минут</h2>

                <div className="mt-2">
                  <label className="text-xs font-semibold text-foreground-muted">Время доставки</label>
                  <select
                    value={deliverySlot}
                    onChange={(e: { target: { value: string } }) => setDeliverySlot(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none hover:border-slate-300 focus:border-brand dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:border-white/20"
                  >
                    <option value="asap">Как можно скорее</option>
                    <option value="by-1930">К 19:30</option>
                    <option value="20-2030">С 20:00 до 20:30</option>
                    <option value="custom">Другое (указать при оформлении)</option>
                  </select>
                  {/* TODO: persist deliverySlot to cart model when backend is ready */}
                </div>

                {totals.totalCount === 0 ? (
                  <div className="mt-3 text-xs text-foreground-muted">
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
                          <div key={offer.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
                            <div className="flex items-start gap-3">
                              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-skeleton-base border border-border shadow-sm dark:bg-white/10 dark:border-white/10">
                                {offer.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={offer.imageUrl}
                                    alt={offer.menuItemName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="px-2 text-center text-[11px] font-medium text-foreground-muted">
                                    пока ещё нет фото!
                                  </span>
                                )}
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col">
                                <div className="line-clamp-2 text-sm font-semibold text-foreground">
                                  {offer.menuItemName}
                                </div>

                                {base?.description && (
                                  <div className="mt-0.5 text-[11px] text-foreground-muted">{base.description}</div>
                                )}

                                <button
                                  type="button"
                                  className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-border bg-white px-2 py-1 text-[11px] font-medium text-foreground-muted hover:border-slate-300 hover:bg-hover active:scale-95 transition-transform transform-gpu dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
                                  onClick={() => {
                                    void (async () => {
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
                                        if (process.env.NODE_ENV === "development") {
                                          console.debug("[CatalogUI] Favorite toggle failed:", e);
                                        }
                                      }
                                    })().catch(() => {
                                      // Silently ignore unhandled promise rejections
                                    });
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

                                <div className="mt-2 flex items-center justify-between rounded-full bg-card border border-border px-3 py-1.5 shadow-sm dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
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
                                      <span className="text-xs text-foreground-muted line-through opacity-60">{lineOldPrice} ₽</span>
                                    )}
                                    <span className="text-sm font-semibold text-foreground">{lineTotal} ₽</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
                              <label className="text-[11px] font-semibold text-foreground-muted">Комментарий для кухни</label>
                              <textarea
                                value={noteState.comment}
                                onChange={(e: { target: { value: string } }) =>
                                  setLineNotes((prev) => ({
                                    ...prev,
                                    [offer.id]: { ...noteState, comment: e.target.value },
                                  }))
                                }
                                rows={2}
                                className="w-full rounded-xl border border-border bg-card px-2 py-1 text-sm text-foreground outline-none hover:border-slate-300 focus:border-brand dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md dark:hover:border-white/20"
                                placeholder="Без лука, соус отдельно..."
                              />
                              <label className="inline-flex items-center gap-2 text-[12px] text-foreground-muted">
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

                    <div className="mt-4 border-t border-border pt-3">
                      <div className="text-center text-xs text-foreground-muted">Итого</div>
                      <div className="text-center text-2xl font-semibold leading-tight text-foreground">
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
                <div className="rounded-3xl bg-card p-3 shadow-vilka-soft dark:bg-white/10 dark:backdrop-blur-md">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="save-cart-name"
                        type="text"
                        placeholder="Например: Обед в офис"
                        className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-brand dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md"
                        onChange={() => {}}
                      />
                      <button
                        type="button"
                        className="rounded-2xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark active:scale-95 transition-transform transform-gpu"
                        onClick={() => {
                          void (async () => {
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
                              if (process.env.NODE_ENV === "development") {
                                console.debug("[CatalogUI] Save cart failed:", e);
                              }
                            }
                          })().catch(() => {
                            // Silently ignore unhandled promise rejections
                          });
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
                        className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-brand dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md"
                      />
                      <button
                        type="button"
                        className="rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm hover:border-border hover:bg-hover active:scale-95 transition-transform transform-gpu dark:bg-white/10 dark:backdrop-blur-md dark:hover:bg-white/20"
                        onClick={() => {
                          void (async () => {
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
                              if (process.env.NODE_ENV === "development") {
                                console.debug("[CatalogUI] Apply saved cart failed:", e);
                              }
                            }
                          })().catch(() => {
                            // Silently ignore unhandled promise rejections
                          });
                        }}
                      >
                        Повторить сет
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-border bg-card p-3 text-xs text-foreground-muted shadow-vilka-soft dark:bg-white/10 dark:border-white/10">
                <p className="font-semibold text-foreground">Вилка пока не везде</p>
                <p className="mt-1 text-foreground-muted">Укажите адрес, чтобы увидеть заведения, которые доставляют именно к вам.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="shrink-0 border-t border-border bg-card dark:border-white/10 dark:bg-white/10 dark:backdrop-blur-md">
        <div className="flex w-full flex-col gap-2 px-6 py-3 text-xs text-foreground-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Вилка. Доставка еды из ресторанов и пекарен.</span>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground hover:border-slate-300 hover:bg-slate-50 active:scale-95 transition-transform transform-gpu">
              Вопросы и поддержка
            </button>
            <button className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground hover:border-slate-300 hover:bg-slate-50 active:scale-95 transition-transform transform-gpu">
              Условия сервиса
            </button>
            <a
              href="/business"
              className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground hover:border-slate-300 hover:bg-slate-50 active:scale-95 transition-transform transform-gpu"
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
          console.log("[CatalogUI] onSuccess called, fetching user data");
          try {
            // Небольшая задержка для гарантии, что cookie установлен
            await new Promise((resolve) => setTimeout(resolve, 100));
            
            const res = await fetch("/api/auth/me", {
              credentials: "include", // Ensure cookies are sent
            });
            console.log("[CatalogUI] /api/auth/me response status:", res.status);
            
            const data = await res.json().catch(() => ({}));
            console.log("[CatalogUI] /api/auth/me response data:", data);
            
            if (data.user) {
              console.log("[CatalogUI] Setting user:", data.user);
              setUser(data.user);

              // IMPORTANT: подтягиваем серверную корзину под новым auth (иначе пустая локальная может затереть user-cart)
              console.log("[CatalogUI] Reloading cart");
              await reloadCart();

              if (pendingAddOfferId != null) {
                console.log("[CatalogUI] Adding pending offer:", pendingAddOfferId);
                add(pendingAddOfferId);
                setPendingAddOfferId(null);
                setIsAuthOpen(false);
              }
            } else {
              console.warn("[CatalogUI] No user in response, user might not be logged in");
            }
          } catch (err) {
            console.error("[CatalogUI] Failed to load user after auth:", err);
            // Не выбрасываем ошибку, чтобы модалка закрылась
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
