"use client";

import { X } from "lucide-react";
import type { CatalogFilters } from "./CatalogFilters";

type ActiveFilterChipsProps = {
  filters: CatalogFilters;
  onRemoveFilter: (key: keyof CatalogFilters, value: any) => void;
};

export function ActiveFilterChips({
  filters,
  onRemoveFilter,
}: ActiveFilterChipsProps) {
  const activeFilters: Array<{ key: keyof CatalogFilters; label: string; value: any }> = [];

  if (filters.minPrice !== null) {
    activeFilters.push({
      key: "minPrice",
      label: `От ${filters.minPrice} ₽`,
      value: null,
    });
  }

  if (filters.maxPrice !== null) {
    activeFilters.push({
      key: "maxPrice",
      label: `До ${filters.maxPrice} ₽`,
      value: null,
    });
  }

  if (filters.spicy !== "any") {
    activeFilters.push({
      key: "spicy",
      label: filters.spicy === "spicy" ? "Острое" : "Не острое",
      value: "any",
    });
  }

  if (filters.vegetarian !== "any") {
    activeFilters.push({
      key: "vegetarian",
      label:
        filters.vegetarian === "vegetarian"
          ? "Вегетарианское"
          : "Не вегетарианское",
      value: "any",
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {activeFilters.map((filter, index) => (
        <button
          key={`${filter.key}-${index}`}
          type="button"
          onClick={() => onRemoveFilter(filter.key, filter.value)}
          className="inline-flex items-center gap-1.5 rounded-full glass glass-subtle px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-hover dark:hover:bg-white/20"
        >
          <span>{filter.label}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

