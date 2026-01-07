"use client";

import { useState, useEffect, useRef } from "react";
import { X, Filter } from "lucide-react";
import type { Offer } from "@/modules/catalog/types";

export type SpicyFilter = "any" | "spicy" | "not_spicy";
export type VegetarianFilter = "any" | "vegetarian" | "not_vegetarian";

export type CatalogFilters = {
  minPrice: number | null;
  maxPrice: number | null;
  spicy: SpicyFilter;
  vegetarian: VegetarianFilter;
};

const DEFAULT_FILTERS: CatalogFilters = {
  minPrice: null,
  maxPrice: null,
  spicy: "any",
  vegetarian: "any",
};

type CatalogFiltersProps = {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  onReset: () => void;
};

export function CatalogFilters({
  filters,
  onFiltersChange,
  onReset,
}: CatalogFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hasActiveFilters =
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.spicy !== "any" ||
    filters.vegetarian !== "any";

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const updateFilter = <K extends keyof CatalogFilters>(
    key: K,
    value: CatalogFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    
    // Validate price range
    if (key === "minPrice" || key === "maxPrice") {
      const min = key === "minPrice" ? (value as number | null) : filters.minPrice;
      const max = key === "maxPrice" ? (value as number | null) : filters.maxPrice;
      
      if (min !== null && max !== null && min > max) {
        setPriceError("Минимальная цена не может быть больше максимальной");
      } else {
        setPriceError(null);
      }
    }
    
    onFiltersChange(newFilters);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    const numValue = value === "" ? null : parseFloat(value);
    if (value !== "" && (isNaN(numValue!) || numValue! < 0)) {
      return;
    }
    updateFilter("minPrice", numValue);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    const numValue = value === "" ? null : parseFloat(value);
    if (value !== "" && (isNaN(numValue!) || numValue! < 0)) {
      return;
    }
    updateFilter("maxPrice", numValue);
  };

  return (
    <div className="relative">
      {/* Filter button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-full glass glass-subtle px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20"
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Фильтры</span>
        {hasActiveFilters && (
          <span className="ml-0.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {[
              filters.minPrice !== null,
              filters.maxPrice !== null,
              filters.spicy !== "any",
              filters.vegetarian !== "any",
            ].filter(Boolean).length}
          </span>
        )}
      </button>

      {/* Filter popup */}
      {isOpen && (
        <div
          ref={popupRef}
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg dark:border-white/20 dark:bg-slate-800"
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Фильтры</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-foreground-muted hover:bg-hover dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Price Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-foreground">
                Цена, ₽
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="От"
                  value={filters.minPrice ?? ""}
                  onChange={handleMinPriceChange}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/5"
                />
                <span className="text-foreground-muted">—</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="До"
                  value={filters.maxPrice ?? ""}
                  onChange={handleMaxPriceChange}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/5"
                />
              </div>
              {priceError && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {priceError}
                </p>
              )}
            </div>

            {/* Spicy Filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-foreground">
                Острота
              </label>
              <div className="flex gap-2">
                {(["any", "spicy", "not_spicy"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateFilter("spicy", value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      filters.spicy === value
                        ? "border-brand bg-brand-light text-brand-dark dark:bg-brand/20 dark:text-brand"
                        : "border-border bg-background text-foreground hover:bg-hover dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {value === "any"
                      ? "Любая"
                      : value === "spicy"
                      ? "Острое"
                      : "Не острое"}
                  </button>
                ))}
              </div>
            </div>

            {/* Vegetarian Filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-foreground">
                Вегетарианское
              </label>
              <div className="flex gap-2">
                {(["any", "vegetarian", "not_vegetarian"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateFilter("vegetarian", value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      filters.vegetarian === value
                        ? "border-brand bg-brand-light text-brand-dark dark:bg-brand/20 dark:text-brand"
                        : "border-border bg-background text-foreground hover:bg-hover dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {value === "any"
                      ? "Любое"
                      : value === "vegetarian"
                      ? "Вегетарианское"
                      : "Не вегетарианское"}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-hover dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Pure function to filter offers
export function filterOffers(
  offers: Offer[],
  filters: CatalogFilters
): Offer[] {
  return offers.filter((offer) => {
    // Price filter
    if (filters.minPrice !== null && offer.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== null && offer.price > filters.maxPrice) {
      return false;
    }

    // Spicy filter
    if (filters.spicy === "spicy" && !offer.isSpicy) {
      return false;
    }
    if (filters.spicy === "not_spicy" && offer.isSpicy) {
      return false;
    }

    // Vegetarian filter
    if (filters.vegetarian === "vegetarian" && !offer.isVegetarian) {
      return false;
    }
    if (filters.vegetarian === "not_vegetarian" && offer.isVegetarian) {
      return false;
    }

    return true;
  });
}

