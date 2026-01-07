"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Category, Subcategory } from "@/modules/catalog/types";
import { CategoryEmoji } from "@/components/CategoryEmoji";

type CategoryId = string;
type SubcategoryId = string;

type CategoriesSidebarProps = {
  categories: Category[];
  subcategories: Subcategory[];
  onCategoryClick?: (categoryId: CategoryId) => void;
  onSubcategoryClick?: (subcategoryId: SubcategoryId) => void;
  compact?: boolean;
};

export function CategoriesSidebar({
  categories,
  subcategories,
  onCategoryClick,
  onSubcategoryClick,
  compact = false,
}: CategoriesSidebarProps) {
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<CategoryId[]>([]);

  const toggleCategoryExpanded = (categoryId: CategoryId) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    toggleCategoryExpanded(categoryId);
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    }
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId) => {
    if (onSubcategoryClick) {
      onSubcategoryClick(subcategoryId);
    }
  };

  return (
    <aside
      className={`hidden h-full w-full shrink-0 overflow-y-auto lg:block ${
        compact ? "lg:w-[180px] xl:w-[200px]" : "lg:w-[200px] xl:w-[240px]"
      }`}
    >
      <div className="flex h-full flex-col gap-3 pb-6">
        <div className="flex flex-1 flex-col rounded-3xl glass p-4 shadow-vilka-soft">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground-muted">
            КАТЕГОРИИ
          </h2>
          <nav className="space-y-1">
            {categories.map((cat) => {
              const isExpanded = expandedCategoryIds.includes(cat.id);
              const subsForCat = subcategories.filter((s) => s.categoryId === cat.id);

              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(cat.id)}
                    title={cat.name}
                    className={[
                      "group flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition",
                      "md:justify-center lg:justify-between",
                      "bg-card text-foreground border border-border font-medium shadow-sm hover:bg-hover hover:border-border dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/10",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted border border-border shadow-sm text-lg md:h-10 md:w-10 dark:bg-white/10 dark:border-white/10">
                        <CategoryEmoji code={cat.id} />
                      </span>
                      <span className="hidden min-w-0 flex-col lg:flex">
                        <span className="truncate text-sm leading-tight">{cat.name}</span>
                        {cat.isPromo && (
                          <span className="mt-0.5 truncate text-[10px] text-foreground-muted">
                            Акции и спецпредложения
                          </span>
                        )}
                      </span>
                    </span>

                    {subsForCat.length > 0 && (
                      <ChevronRight
                        className={[
                          "hidden h-4 w-4 shrink-0 text-foreground-muted transition-transform lg:block",
                          isExpanded ? "rotate-90" : "",
                        ].join(" ")}
                      />
                    )}
                  </button>

                  {isExpanded && subsForCat.length > 0 && (
                    <div className="mt-1 hidden space-y-0.5 pl-0 lg:block lg:pl-3">
                      {subsForCat.map((sub) => {
                        return (
                          <div key={sub.id}>
                            <button
                              type="button"
                              onClick={() => handleSubcategoryClick(sub.id)}
                              title={sub.name}
                              className="flex w-full min-w-0 items-center justify-between rounded-2xl px-3 py-1.5 text-left text-xs transition bg-transparent text-foreground font-medium hover:bg-hover dark:hover:bg-white/10"
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
      </div>
    </aside>
  );
}

