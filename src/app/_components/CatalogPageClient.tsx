"use client";

import { useEffect, useMemo, useState, useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ShoppingBag, MapPin, User, Search, Clock, ChevronRight, MessageCircle, MoreVertical } from "lucide-react";

import AuthModal from "@/components/AuthModal";
import AddressModal from "@/components/AddressModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import AnonymousOfferCard from "@/components/AnonymousOfferCard";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import { MenuOptionButton } from "@/components/MenuOptionButton";
import { QuantityControls } from "@/components/QuantityControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchResults } from "@/components/SearchResults";
import { CatalogFilters, filterOffers, type CatalogFilters as CatalogFiltersType } from "@/components/CatalogFilters";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { Heart } from "lucide-react";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import { buildCatalogIndexes } from "@/modules/catalog/indexes";
import { ensureValidSelection, type Selection } from "@/modules/catalog/selection";
import type { BaseItemId, CatalogData, CategoryId, SubcategoryId } from "@/modules/catalog/types";
import { queryStringToFilters, updateURLFilters } from "@/lib/filterUtils";
import { CategoryEmoji } from "@/components/CategoryEmoji";
import { devLog, devError } from "@/lib/apiClient";
import { apiClient } from "@/lib/apiClient";

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

// CategoryEmoji is now imported from shared component

function CatalogUI({
  catalog,
  indexes,
}: CatalogPageClientProps & { indexes: CatalogIndexes }) {
  const { quantities, entries, totals, offerStocks, add, remove, reload: reloadCart } = useCart();

  // Agent logging is now handled via fetch monkey-patch in layout.tsx
  // This section removed - no longer needed

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  // Важно: desktop и mobile хедеры одновременно в DOM (только CSS скрывает),
  // поэтому один ref на два элемента ломает "click outside" (закрывает меню до клика по пунктам).
  const moreMenuRefDesktop = useRef<HTMLDivElement | null>(null);
  const moreMenuRefMobile = useRef<HTMLDivElement | null>(null);

  // Filters state
  const [filters, setFilters] = useState<CatalogFiltersType>(() => {
    if (typeof window !== "undefined") {
      return queryStringToFilters(new URLSearchParams(window.location.search));
    }
    return {
      minPrice: null,
      maxPrice: null,
      spicy: "any",
      vegetarian: "any",
    };
  });

  // анимация "надавливания" для карточек (через capture, чтобы работало даже если внутри stopPropagation)
  // Замените существующее состояние pressedCardId на:
  const [pressedCardId, setPressedCardId] = useState<string | number | null>(null);
  const [pressedCardState, setPressedCardState] = useState<'down' | 'up' | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Track if selection changes are user-initiated (to prevent useEffect from overriding)
  const isUserInitiatedChangeRef = useRef(false);
  
  // Initialize from URL params if present, otherwise use default
  const urlCategoryId = searchParams.get("category");
  const urlSubcategoryId = searchParams.get("subcategory");
  const urlItemId = searchParams.get("item");
  
  // Build lookup maps for initial selection (before maps are defined)
  const categoryByIdMapForInit = useMemo(() => {
    const map = new Map<CategoryId, typeof catalog.categories[number]>();
    for (const cat of catalog.categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [catalog.categories]);

  const subcategoryByIdMapForInit = useMemo(() => {
    const map = new Map<SubcategoryId, typeof catalog.subcategories[number]>();
    for (const sub of catalog.subcategories) {
      map.set(sub.id, sub);
    }
    return map;
  }, [catalog.subcategories]);

  const subcategoriesByCategoryForInit = useMemo(() => {
    const map = new Map<CategoryId, typeof catalog.subcategories>();
    for (const sub of catalog.subcategories) {
      const list = map.get(sub.categoryId) ?? [];
      map.set(sub.categoryId, [...list, sub]);
    }
    return map;
  }, [catalog.subcategories]);

  const baseItemByIdMapForInit = useMemo(() => {
    const map = new Map<BaseItemId, typeof catalog.baseItems[number]>();
    for (const item of catalog.baseItems) {
      map.set(item.id, item);
    }
    return map;
  }, [catalog.baseItems]);

  const initial = useMemo(() => {
    if (urlCategoryId) {
      const category = categoryByIdMapForInit.get(urlCategoryId);
      if (category) {
        const subcategory = urlSubcategoryId
          ? subcategoryByIdMapForInit.get(urlSubcategoryId)
          : subcategoriesByCategoryForInit.get(urlCategoryId)?.[0];
        const item = urlItemId
          ? baseItemByIdMapForInit.get(urlItemId)
          : null;
        // If item is specified, ensure it belongs to the subcategory
        const validItem = item && subcategory && item.subcategoryId === subcategory.id ? item : null;
        return {
          categoryId: urlCategoryId,
          subcategoryId: subcategory?.id ?? null,
          itemId: validItem?.id ?? null,
        };
      }
    }
    return getInitialSelection(catalog);
  }, [urlCategoryId, urlSubcategoryId, urlItemId, categoryByIdMapForInit, subcategoryByIdMapForInit, subcategoriesByCategoryForInit, baseItemByIdMapForInit]);
  
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | null>(initial.categoryId);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<SubcategoryId | null>(initial.subcategoryId);
  const [activeItemId, setActiveItemId] = useState<BaseItemId | null>(initial.itemId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<CategoryId[]>(
    initial.categoryId ? [initial.categoryId] : []
  );
  
  const { categories, subcategories, baseItems } = catalog;

  // Optimized lookup maps for O(1) access instead of O(n) find()
  // Define these early so they can be used in useEffect dependencies
  const offerByIdMap = useMemo(() => {
    const map = new Map<string, typeof catalog.offers[number]>();
    for (const offer of catalog.offers) {
      map.set(offer.id, offer);
    }
    return map;
  }, [catalog.offers]);

  const baseItemByIdMap = useMemo(() => {
    const map = new Map<BaseItemId, typeof catalog.baseItems[number]>();
    for (const item of catalog.baseItems) {
      map.set(item.id, item);
    }
    return map;
  }, [catalog.baseItems]);

  const subcategoryByIdMap = useMemo(() => {
    const map = new Map<SubcategoryId, typeof catalog.subcategories[number]>();
    for (const sub of catalog.subcategories) {
      map.set(sub.id, sub);
    }
    return map;
  }, [catalog.subcategories]);

  const categoryByIdMap = useMemo(() => {
    const map = new Map<CategoryId, typeof catalog.categories[number]>();
    for (const cat of catalog.categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [catalog.categories]);
  
  // Update selection when URL params change (only if not user-initiated)
  useEffect(() => {
    if (isUserInitiatedChangeRef.current) {
      isUserInitiatedChangeRef.current = false;
      return;
    }
    if (urlCategoryId && urlCategoryId !== activeCategoryId) {
      setActiveCategoryId(urlCategoryId);
      if (urlSubcategoryId) {
        setActiveSubcategoryId(urlSubcategoryId);
      } else {
        setActiveSubcategoryId(null);
      }
      if (urlItemId) {
        const item = baseItemByIdMap.get(urlItemId);
        if (item && item.categoryId === urlCategoryId && (!urlSubcategoryId || item.subcategoryId === urlSubcategoryId)) {
          setActiveItemId(urlItemId);
        } else {
          setActiveItemId(null);
        }
      } else {
        setActiveItemId(null);
      }
      setExpandedCategoryIds((prev) =>
        prev.includes(urlCategoryId) ? prev : [...prev, urlCategoryId]
      );
    } else if (urlCategoryId === activeCategoryId) {
      // Category matches, check if subcategory or item changed
      if (urlSubcategoryId && urlSubcategoryId !== activeSubcategoryId) {
        setActiveSubcategoryId(urlSubcategoryId);
        if (urlItemId) {
          const item = baseItemByIdMap.get(urlItemId);
          if (item && item.subcategoryId === urlSubcategoryId) {
            setActiveItemId(urlItemId);
          } else {
            setActiveItemId(null);
          }
        } else {
          setActiveItemId(null);
        }
      } else if (!urlSubcategoryId && activeSubcategoryId) {
        setActiveSubcategoryId(null);
        setActiveItemId(null);
      } else if (urlItemId && urlItemId !== activeItemId) {
        const item = baseItemByIdMap.get(urlItemId);
        if (item && item.categoryId === activeCategoryId && (!activeSubcategoryId || item.subcategoryId === activeSubcategoryId)) {
          setActiveItemId(urlItemId);
        }
      } else if (!urlItemId && activeItemId) {
        setActiveItemId(null);
      }
    } else if (!urlCategoryId && activeCategoryId) {
      // URL cleared but state still has category - don't reset, let user keep selection
    }
  }, [urlCategoryId, urlSubcategoryId, urlItemId, activeCategoryId, activeSubcategoryId, activeItemId, baseItemByIdMap]);

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
        const offer = offerByIdMap.get(String(result.id));
        if (offer) {
          const baseItem = baseItemByIdMap.get(offer.baseItemId);
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
      
      devLog(`Fetching: ${url} (seq: ${currentSeq})`);
      
      // Retry logic with backoff
      const MAX_RETRIES = 2;
      const RETRY_DELAYS = [200, 400]; // ms
      
      for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
        // Check if this request is still the latest
        if (currentSeq !== searchRequestSeqRef.current) {
        devLog(`Request ${currentSeq} superseded, aborting`);
          return;
        }
        
        // Check if aborted
        if (abortController.signal.aborted) {
          devLog(`Request ${currentSeq} aborted`);
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
            devError(`API error (seq ${currentSeq}):`, data.error);
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
            const offer = offerByIdMap.get(String(result.id));
            if (offer) {
              const baseItem = baseItemByIdMap.get(offer.baseItemId);
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
          
          if (data.debug) {
            devLog(`Success (seq ${currentSeq}):`, data.debug);
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
          devError(`Fetch error (seq ${currentSeq}):`, error);
          
          // Keep previous results, show error hint
          setSearchError("Ошибка сети. Попробуйте ещё раз.");
          setIsSearching(false);
          searchAbortControllerRef.current = null;
          return;
        }
      }
      })().catch((err) => {
        // Silently catch any unhandled promise rejections
        devError("Unhandled error in search effect:", err);
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
  }, [searchQuery, offerByIdMap, baseItemByIdMap]);

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

  // Initialize filters from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlFilters = queryStringToFilters(new URLSearchParams(window.location.search));
      setFilters(urlFilters);
    }
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (typeof window !== "undefined") {
      updateURLFilters(filters, searchQuery || undefined);
    }
  }, [filters, searchQuery]);

  const handleFiltersChange = (newFilters: CatalogFiltersType) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    const defaultFilters: CatalogFiltersType = {
      minPrice: null,
      maxPrice: null,
      spicy: "any",
      vegetarian: "any",
    };
    setFilters(defaultFilters);
  };

  const handleRemoveFilter = (key: keyof CatalogFiltersType, value: any) => {
    const newFilters = { ...filters };
    if (key === "minPrice" || key === "maxPrice") {
      newFilters[key] = null;
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
  };

  // Helper functions to map menu_item_id to catalog IDs (optimized with Maps)
  const getItemId = useCallback(
    (menuItemId: number): BaseItemId | null => {
      const offer = offerByIdMap.get(String(menuItemId));
      return offer?.baseItemId || null;
    },
    [offerByIdMap]
  );

  const getCategoryId = useCallback(
    (menuItemId: number): CategoryId | null => {
      const baseItemId = getItemId(menuItemId);
      if (!baseItemId) return null;
      const baseItem = baseItemByIdMap.get(baseItemId);
      return baseItem?.categoryId || null;
    },
    [getItemId, baseItemByIdMap]
  );

  const getSubcategoryId = useCallback(
    (menuItemId: number): SubcategoryId | null => {
      const baseItemId = getItemId(menuItemId);
      if (!baseItemId) return null;
      const baseItem = baseItemByIdMap.get(baseItemId);
      return baseItem?.subcategoryId || null;
    },
    [getItemId, baseItemByIdMap]
  );

  const handleSearchResultSelect = (itemId: BaseItemId, categoryId: CategoryId, subcategoryId: SubcategoryId) => {
    isUserInitiatedChangeRef.current = true;
    setActiveCategoryId(categoryId);
    setActiveSubcategoryId(subcategoryId);
    setActiveItemId(itemId);
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev : [...prev, categoryId]
    );
    setIsSearchResultsOpen(false);
    setSearchQuery("");
    
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", categoryId);
    params.set("subcategory", subcategoryId);
    params.set("item", itemId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleCategoryExpanded = (categoryId: CategoryId) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    isUserInitiatedChangeRef.current = true;
    setActiveCategoryId(categoryId);
    // Reset deeper levels: user should explicitly choose subcategory (2nd) and item (3rd).
    setActiveSubcategoryId(null);
    setActiveItemId(null);
    toggleCategoryExpanded(categoryId);
    
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", categoryId);
    params.delete("subcategory");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const sub = subcategoryByIdMap.get(subcategoryId);
    if (!sub) return;

    isUserInitiatedChangeRef.current = true;
    setActiveCategoryId(sub.categoryId);
    setActiveSubcategoryId(sub.id);
    // 3rd level should be chosen by the user in the main content area.
    setActiveItemId(null);
    setExpandedCategoryIds((prev) => (prev.includes(sub.categoryId) ? prev : [...prev, sub.categoryId]));
    
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", sub.categoryId);
    params.set("subcategory", sub.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleItemClick = (itemId: BaseItemId) => {
    const item = baseItemByIdMap.get(itemId);
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

  // Apply filters to offers
  const filteredOffers = useMemo(
    () => filterOffers(offersForItem, filters),
    [offersForItem, filters]
  );

  const anonOffer = filteredOffers.find((o) => o.isAnonymous);
  const brandedOffers = filteredOffers.filter((o) => !o.isAnonymous);

  const cartButtonLabel = totals.totalPrice > 0 ? `${totals.totalPrice} ₽` : "0 ₽";
  const cartCountLabel = totals.totalCount > 0 ? `${totals.totalCount}` : "0";

  const currentCategory = activeCategoryId ? categoryByIdMap.get(activeCategoryId) : undefined;
  const currentSubcategory = activeSubcategoryId ? subcategoryByIdMap.get(activeSubcategoryId) : undefined;
  const currentItem = activeItemId ? baseItemByIdMap.get(activeItemId) : undefined;

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
    const sub = subcategoryByIdMap.get(subcategoryId);
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
            <div className="rounded-2xl border border-dashed glass p-4 text-xs text-foreground-muted">
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
            <div className="rounded-2xl border border-dashed glass p-4 text-xs text-foreground-muted">
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
        const data = await apiClient.get<{ user?: any }>("/api/auth/me", {
          headers: { credentials: "include" },
        });
        setUser(data.user);
      } catch (err) {
        // Silently ignore errors - user might not be logged in
        devError("Failed to load user:", err);
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
        moreMenuRefDesktop.current ? moreMenuRefDesktop.current.contains(target) : false;
      const inMobile =
        moreMenuRefMobile.current ? moreMenuRefMobile.current.contains(target) : false;

      if (!inDesktop && !inMobile) {
        setIsMoreMenuOpen(false);
      }
    };

    if (isMoreMenuOpen) {
      // Важно: используем "click", а не "mousedown", иначе меню может закрыться
      // на mousedown и "Выйти" не успевает обработать клик/переход.
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isMoreMenuOpen]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-transparent transition-colors dark:bg-background">
      <header className="shrink-0 z-40 border-b glass glass-strong">
        <div className="hidden md:block">
          <div className="glass glass-strong">
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

              <div className="hidden flex-1 flex-col gap-2 md:flex">
                <div className="flex items-center gap-2">
                  <div className="relative flex flex-1 items-center gap-3 rounded-full glass glass-subtle px-4 py-2 shadow-vilka-soft">
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
                  {/* Filter button */}
                  <CatalogFilters
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onReset={handleResetFilters}
                  />
                </div>
                {/* Active filter chips */}
                <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} />
              </div>

              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                {/* Address button - primary if no address, neutral if selected */}
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsAddressOpen(true)}
                    className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm md:flex ${
                      currentAddressLabel === "Указать адрес доставки"
                        ? "border-brand bg-brand text-white hover:bg-brand-dark"
                        : "glass glass-subtle text-foreground hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="max-w-[220px] truncate">{currentAddressLabel}</span>
                  </button>
                )}

                {/* More menu button */}
                {user ? (
                  <div className="relative hidden md:block" ref={moreMenuRefDesktop}>
                    <button
                      type="button"
                      onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                      className="flex h-8 w-8 items-center justify-center rounded-full glass glass-subtle text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {isMoreMenuOpen && (
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-300 bg-slate-800 shadow-lg dark:border-white/20 dark:bg-slate-800">
                        <div className="p-2">
                          {/* User info */}
                          <div className="px-3 py-2 text-xs text-white">
                            {user.phone.startsWith("tg:")
                              ? user.telegram?.username
                                ? `@${user.telegram.username}`
                                : user.telegram?.firstName || user.telegram?.lastName
                                ? `Telegram • ${(user.telegram.firstName ?? "").trim()} ${(user.telegram.lastName ?? "").trim()}`.trim()
                                : "Telegram"
                              : user.phone}
                          </div>
                          {/* Chatbot */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAssistantOpen(true);
                              setIsMoreMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Чат‑бот</span>
                          </button>
                          {/* Logout */}
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
                    className="hidden items-center gap-2 rounded-full glass glass-subtle px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20 md:flex"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Войти</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMiniCartOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full glass glass-subtle px-3 py-1.5 text-sm font-bold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
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
                              className="flex items-center justify-between rounded-xl glass px-2 py-2"
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

            {/* Address button - primary if no address, neutral if selected */}
            {user && (
              <button
                type="button"
                onClick={() => setIsAddressOpen(true)}
                className={`flex flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm ${
                  currentAddressLabel === "Указать адрес доставки"
                    ? "border-brand bg-brand text-white hover:bg-brand-dark"
                    : "glass glass-subtle text-foreground hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{currentAddressLabel}</span>
              </button>
            )}

            {/* More menu button */}
            {user ? (
              <div className="relative" ref={moreMenuRefMobile}>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full glass glass-subtle text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-300 bg-slate-800 shadow-lg dark:border-white/20 dark:bg-slate-800">
                    <div className="p-2">
                      {/* User info */}
                      <div className="px-3 py-2 text-xs text-white">
                        {user.phone.startsWith("tg:")
                          ? user.telegram?.username
                            ? `@${user.telegram.username}`
                            : user.telegram?.firstName || user.telegram?.lastName
                            ? `Telegram • ${(user.telegram.firstName ?? "").trim()} ${(user.telegram.lastName ?? "").trim()}`.trim()
                            : "Telegram"
                          : user.phone}
                      </div>
                      {/* Chatbot */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAssistantOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Чат‑бот</span>
                      </button>
                      {/* Logout */}
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

            <button className="flex h-8 items-center justify-center rounded-full bg-brand px-3 text-[11px] font-semibold text-white shadow-md shadow-brand/30 hover:bg-brand-dark">
              {cartButtonLabel}
            </button>
          </div>

          <div className="sticky top-0 z-30 bg-background/95 glass glass-strong">
            <div className="mx-auto max-w-7xl px-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="relative flex flex-1 items-center gap-3 rounded-full glass glass-subtle px-4 py-2 shadow-vilka-soft">
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
                {/* Filter button for mobile */}
                <CatalogFilters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onReset={handleResetFilters}
                />
              </div>
              {/* Active filter chips for mobile */}
              <div className="mt-2">
                <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 pt-4 md:pt-6">
        <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 md:grid-cols-[64px_minmax(0,1fr)_320px] lg:grid-cols-[200px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside
            className="hidden h-full w-full overflow-y-auto rounded-3xl glass shadow-vilka-soft md:block md:w-auto md:border"
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
                            className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3"
                          >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted border border-border shadow-sm text-lg md:h-10 md:w-10 dark:bg-white/10 dark:border-white/10">
                            <CategoryEmoji code={cat.id} />
                          </span>
                          <span
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
                                  onClick={(e) => handleSubcategoryClick(sub.id, e)}
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

          <section className="flex min-w-0 flex-1 min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl glass p-4 shadow-vilka-soft">
            {/* Информационный блок */}
              <div className="rounded-[var(--vilka-radius-xl)] glass p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-md">
                  <div className="inline-flex items-center gap-2 rounded-full glass glass-subtle px-3 py-1 text-xs font-medium text-foreground shadow-sm">
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

                <div className="flex flex-col gap-2 rounded-3xl glass p-4 text-sm sm:w-64">
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
                renderOffersBlock(currentItem, filteredOffers)
              ) : itemsForSubcategory.length > 0 ? (
                <div className="flex flex-col gap-10">
                  {itemsForSubcategory.map((item) => {
                    const offers = indexes.offersByBaseItem.get(item.id) ?? [];
                    if (offers.length === 0) return null;
                    const filtered = filterOffers(offers, filters);

                    return (
                      <div key={item.id} className="flex flex-col gap-6">
                        <h2 className="text-4xl font-bold text-foreground">{item.name}</h2>
                        {renderOffersBlock(item, filtered)}
                      </div>
                    );
                  })}
                </div>
              ) : null}
          </section>

          <aside className="hidden h-full w-full shrink-0 overflow-y-auto lg:block">
            <div className="flex h-full flex-col gap-3 pb-6">
              <div className="flex flex-1 flex-col rounded-3xl glass p-4 shadow-vilka-soft">
                <h2 className="text-base font-semibold text-foreground">Доставка 15 минут</h2>

                <div className="mt-2">
                  <label className="text-xs font-semibold text-foreground-muted">Время доставки</label>
                  <select
                    value={deliverySlot}
                    onChange={(e: { target: { value: string } }) => setDeliverySlot(e.target.value)}
                    className="mt-1 w-full rounded-2xl glass glass-subtle px-3 py-2 text-sm text-foreground outline-none hover:border-slate-300 focus:border-brand dark:hover:border-white/20"
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
                          <div key={offer.id} className="flex flex-col gap-2 rounded-2xl glass p-3">
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
                                  className="mt-1 inline-flex w-fit items-center gap-1 rounded-full glass glass-subtle px-2 py-1 text-[11px] font-medium text-foreground-muted hover:border-slate-300 hover:bg-hover active:scale-95 transition-transform transform-gpu dark:hover:bg-white/20"
                                  onClick={() => {
                                    void (async () => {
                                      const next = !lineFavorites[offer.id];
                                      setLineFavorites((prev) => ({ ...prev, [offer.id]: next }));
                                      try {
                                        await apiClient.post("/api/favorites/toggle", {
                                          body: {
                                            userId: 1,
                                            menuItemId: Number(offer.baseItemId),
                                            favorite: next,
                                          },
                                        });
                                      } catch (e) {
                                        devError("Favorite toggle failed:", e);
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

                                <div className="mt-2 flex items-center justify-between rounded-full glass glass-subtle px-3 py-1.5 shadow-sm">
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

                            {/* Комментарий для кухни и политика замены временно скрыты */}
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
                <div className="rounded-3xl glass p-3 shadow-vilka-soft">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="save-cart-name"
                        type="text"
                        placeholder="Например: Обед в офис"
                        className="w-full rounded-2xl glass glass-subtle px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-brand"
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
                              await apiClient.post("/api/cart/save", {
                                body: { cartId: 1, userId: 1, name },
                              });
                            } catch (e) {
                              devError("Save cart failed:", e);
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
                        className="w-full rounded-2xl glass glass-subtle px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-brand"
                      />
                      <button
                        type="button"
                        className="rounded-2xl glass glass-subtle px-3 py-2 text-sm font-semibold text-foreground shadow-sm hover:border-border hover:bg-hover active:scale-95 transition-transform transform-gpu dark:hover:bg-white/20"
                        onClick={() => {
                          void (async () => {
                            const input = document.getElementById("apply-saved-id") as HTMLInputElement | null;
                            const id = input?.value;
                            if (!id) return;
                            try {
                              await apiClient.post("/api/cart/apply-saved", {
                                body: { savedCartId: Number(id) },
                              });
                            } catch (e) {
                              devError("Apply saved cart failed:", e);
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

      <footer className="shrink-0 border-t glass glass-strong">
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
            
            const data = await apiClient.get<{ user?: any }>("/api/auth/me", {
              headers: { credentials: "include" },
            });
            
            devLog("/api/auth/me response", data);
            
            if (data.user) {
              devLog("Setting user:", data.user);
              setUser(data.user);

              // IMPORTANT: подтягиваем серверную корзину под новым auth (иначе пустая локальная может затереть user-cart)
              devLog("Reloading cart");
              await reloadCart();

              if (pendingAddOfferId != null) {
                devLog("Adding pending offer:", pendingAddOfferId);
                add(pendingAddOfferId);
                setPendingAddOfferId(null);
                setIsAuthOpen(false);
              }
            } else {
              devWarn("No user in response, user might not be logged in");
            }
          } catch (err) {
            devError("Failed to load user after auth:", err);
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
