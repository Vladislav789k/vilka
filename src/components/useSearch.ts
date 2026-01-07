"use client";

import { useEffect, useState, useRef } from "react";
import { apiClient, RequestSequence, devLog } from "@/lib/apiClient";
import { useDebounce } from "@/lib/hooks/useDebounce";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type SearchResult = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number | null;
  image_url: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  score: number;
  match_type: "exact" | "prefix" | "substring" | "typo" | "trigram";
};

type SearchData = {
  results: SearchResult[];
  hint?: string;
  shouldAutoNavigate?: boolean;
  debug?: any;
};

type UseSearchOptions = {
  // No options needed - result selection is handled by parent component
};

export function useSearch(_options: UseSearchOptions = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState<string | undefined>(undefined);
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRequestSeq = useRef(new RequestSequence());
  const searchCacheRef = useRef<Map<string, { data: SearchData; timestamp: number }>>(new Map());
  
  // Debounce search query
  const debouncedQuery = useDebounce(searchQuery.trim(), 400);

  useEffect(() => {
    const q = debouncedQuery;

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
      return;
    }

    // Increment request sequence for this new query
    const currentSeq = searchRequestSeq.current.next();

    // Execute search with retry logic via apiClient
    setIsSearching(true);
    void (async () => {
      try {
        const isDev = process.env.NODE_ENV === "development";
        const url = `/api/search?q=${encodeURIComponent(q)}&limit=10${isDev ? "&debug=true" : ""}`;

        const data = await apiClient.get<SearchData>(url, {
          retry: {
            maxRetries: 2,
            retryDelays: [200, 400],
          },
        });

        // Check if this request is still the latest
        if (!searchRequestSeq.current.isLatest(currentSeq)) {
          devLog(`Request ${currentSeq} superseded, ignoring response`);
          return;
        }

        if (data.error) {
          devLog(`API error (seq ${currentSeq}):`, data.error);
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
        setSearchError(null);
        setIsSearchResultsOpen(results.length > 0 || !!data.hint);
        setIsSearching(false);

        if (isDev && data.debug) {
          devLog(`Success (seq ${currentSeq}):`, data.debug);
        }
      } catch (error: any) {
        // Check if this request is still the latest
        if (!searchRequestSeq.current.isLatest(currentSeq)) {
          devLog(`Request ${currentSeq} superseded during error handling`);
          return;
        }

        // Error handling - apiClient already retried
        devLog(`Final error (seq ${currentSeq}):`, error);
        setSearchError("Ошибка сети. Проверьте подключение.");
        setIsSearching(false);
      }
    })();
  }, [debouncedQuery]);

  // Close search results on outside click
  useEffect(() => {
    if (!isSearchResultsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('[data-search-results]') &&
        !target.closest('[data-search-input]')
      ) {
        setIsSearchResultsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchResultsOpen]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchError,
    searchHint,
    isSearchResultsOpen,
    setIsSearchResultsOpen,
    searchInputRef,
  };
}

