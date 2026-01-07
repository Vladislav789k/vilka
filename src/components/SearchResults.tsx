"use client";

import { X, ShoppingCart, ExternalLink } from "lucide-react";
import { useCart } from "@/modules/cart/cartContext";
import type { BaseItemId, CategoryId, SubcategoryId } from "@/modules/catalog/types";
import { useState, useEffect, useRef } from "react";
import { tokenizeRu } from "@/lib/search/normalizeRu";

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

type SearchResultsProps = {
  results: SearchResult[];
  query: string;
  hint?: string;
  error?: string | null;
  onClose: () => void;
  onSelectItem: (itemId: BaseItemId, categoryId: CategoryId, subcategoryId: SubcategoryId) => void;
  getItemId: (menuItemId: number) => BaseItemId | null;
  getCategoryId: (menuItemId: number) => CategoryId | null;
  getSubcategoryId: (menuItemId: number) => SubcategoryId | null;
};

/**
 * Highlights matching tokens in original text safely
 * Uses case-insensitive matching but preserves original case in output
 */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  
  const queryTokens = tokenizeRu(query);
  if (queryTokens.length === 0) return text;
  
  const normalizedText = text.toLowerCase();
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number }> = [];
  
  // Find all token matches in normalized text
  for (const token of queryTokens) {
    if (token.length < 2) continue; // Skip very short tokens
    
    let searchIndex = 0;
    while (true) {
      const index = normalizedText.indexOf(token, searchIndex);
      if (index === -1) break;
      matches.push({ start: index, end: index + token.length });
      searchIndex = index + 1;
    }
  }
  
  if (matches.length === 0) return text;
  
  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);
  
  // Merge overlapping matches
  const mergedMatches: Array<{ start: number; end: number }> = [];
  for (const match of matches) {
    if (mergedMatches.length === 0 || match.start > mergedMatches[mergedMatches.length - 1].end) {
      mergedMatches.push(match);
    } else {
      mergedMatches[mergedMatches.length - 1].end = Math.max(
        mergedMatches[mergedMatches.length - 1].end,
        match.end
      );
    }
  }
  
  // Build highlighted result using original text (preserves case)
  for (const match of mergedMatches) {
    if (match.start > lastIndex) {
      result.push(text.substring(lastIndex, match.start));
    }
    result.push(
      <mark
        key={`${match.start}-${match.end}`}
        className="bg-yellow-200 dark:bg-yellow-900/50 font-semibold"
      >
        {text.substring(match.start, match.end)}
      </mark>
    );
    lastIndex = match.end;
  }
  
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }
  
  return result.length > 0 ? <>{result}</> : text;
}

export function SearchResults({
  results,
  query,
  hint,
  error,
  onClose,
  onSelectItem,
  getItemId,
  getCategoryId,
  getSubcategoryId,
}: SearchResultsProps) {
  const { add } = useCart();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            const result = results[selectedIndex];
            const itemId = getItemId(result.id);
            const categoryId = getCategoryId(result.id);
            const subcategoryId = getSubcategoryId(result.id);
            if (itemId && categoryId && subcategoryId) {
              onSelectItem(itemId, categoryId, subcategoryId);
              onClose();
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selectedIndex, onSelectItem, onClose, getItemId, getCategoryId, getSubcategoryId]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex];
    if (selectedElement && listRef.current) {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  if (results.length === 0) {
    return (
      <div
        className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-white border border-border text-slate-900 shadow-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
        data-shimmer-exclude
      >
        <div className="p-6 text-center">
          {error ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : hint ? (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{hint}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Ничего не найдено по запросу &quot;{query}&quot;
              </p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                Попробуйте изменить запрос или выберите категорию
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-white border border-border text-slate-900 shadow-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
      data-shimmer-exclude
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          Найдено: {results.length}
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-slate-500 dark:text-slate-300" />
        </button>
      </div>
      <div ref={listRef} className="divide-y divide-border dark:divide-slate-700">
        {results.map((result, index) => {
          const itemId = getItemId(result.id);
          const categoryId = getCategoryId(result.id);
          const subcategoryId = getSubcategoryId(result.id);
          const finalPrice = result.discount_percent
            ? Math.round(result.price * (1 - result.discount_percent / 100))
            : result.price;
          const isSelected = index === selectedIndex;

          if (!itemId || !categoryId || !subcategoryId) {
            return null;
          }

          const handleOpen = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (onSelectItem && itemId && categoryId && subcategoryId) {
              onSelectItem(itemId, categoryId, subcategoryId);
              onClose();
            }
          };

          return (
            <div
              key={result.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={`flex items-center gap-3 p-3 transition-colors ${
                isSelected
                  ? "bg-slate-100 dark:bg-slate-700"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              {result.image_url ? (
                <img
                  src={result.image_url}
                  alt={result.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 border border-border shadow-sm dark:bg-slate-700 dark:border-slate-600">
                  <span className="text-xs text-slate-500 dark:text-slate-300">нет фото</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                  {highlightMatches(result.name, query)}
                </h3>
                {result.description && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {highlightMatches(result.description, query)}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  {result.discount_percent && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      -{result.discount_percent}%
                    </span>
                  )}
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {finalPrice} ₽
                  </span>
                  {result.discount_percent && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 line-through">
                      {result.price} ₽
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleOpen}
                  className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm transition-all duration-150 hover:bg-slate-100 active:scale-95 transform-gpu dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                  aria-label="Открыть"
                  type="button"
                >
                  <ExternalLink className="h-3 w-3" />
                  Открыть
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // result.id is menu_item_id, which should match offer.id
                    add(String(result.id));
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-dark active:scale-95 transform-gpu dark:border-brand dark:bg-brand dark:hover:bg-brand-dark"
                  aria-label="В корзину"
                  type="button"
                >
                  <ShoppingCart className="h-3 w-3" />
                  В корзину
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {results.length >= 10 && (
        <div className="border-t border-border bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-2 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Показано {results.length} результатов. Уточните запрос для более точного поиска.
          </p>
        </div>
      )}
    </div>
  );
}
