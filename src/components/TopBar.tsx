"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShoppingBag, MapPin, User, Search, MessageCircle, MoreVertical } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchResults } from "@/components/SearchResults";
import { CatalogFilters, type CatalogFilters as CatalogFiltersType } from "@/components/CatalogFilters";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { QuantityControls } from "@/components/QuantityControls";
import { useCart } from "@/modules/cart/cartContext";
import { useSearch } from "@/components/useSearch";
import type { BaseItemId, CategoryId, SubcategoryId } from "@/modules/catalog/types";

type User = {
  phone: string;
  telegram?: {
    username?: string;
    firstName?: string;
    lastName?: string;
  };
};

type TopBarProps = {
  // Search
  onSearchResultSelect?: (itemId: BaseItemId, categoryId: CategoryId, subcategoryId: SubcategoryId) => void;
  getItemId?: (menuItemId: number) => BaseItemId | null;
  getCategoryId?: (menuItemId: number) => CategoryId | null;
  getSubcategoryId?: (menuItemId: number) => SubcategoryId | null;
  // Filters (optional - only show if provided)
  filters?: CatalogFiltersType;
  onFiltersChange?: (filters: CatalogFiltersType) => void;
  onResetFilters?: () => void;
  onRemoveFilter?: (key: keyof CatalogFiltersType) => void;
  // Auth
  user: User | null;
  onAuthClick?: () => void;
  onAssistantClick?: () => void;
  // Address
  currentAddressLabel?: string;
  onAddressClick?: () => void;
  // Catalog data for search result mapping (optional)
  catalog?: any;
};

export function TopBar({
  onSearchResultSelect,
  getItemId,
  getCategoryId,
  getSubcategoryId,
  filters,
  onFiltersChange,
  onResetFilters,
  onRemoveFilter,
  user,
  onAuthClick,
  onAssistantClick,
  currentAddressLabel = "Указать адрес доставки",
  onAddressClick,
  catalog,
}: TopBarProps) {
  const { quantities, entries, totals, offerStocks, add, remove } = useCart();
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRefDesktop = useRef<HTMLDivElement>(null);
  const moreMenuRefMobile = useRef<HTMLDivElement>(null);

  const search = useSearch();

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the menu - buttons inside will handle their own clicks
      if (moreMenuRefDesktop.current && moreMenuRefDesktop.current.contains(target)) {
        return; // Let the button's onClick handle it
      }
      if (moreMenuRefDesktop.current && !moreMenuRefDesktop.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
      if (moreMenuRefMobile.current && moreMenuRefMobile.current.contains(target)) {
        return; // Let the button's onClick handle it
      }
      if (moreMenuRefMobile.current && !moreMenuRefMobile.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    // Use 'click' instead of 'mousedown' to allow button onClick to fire first
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const cartButtonLabel = totals.totalPrice > 0 ? `${totals.totalPrice} ₽` : "0 ₽";
  const cartCountLabel = totals.totalCount > 0 ? `${totals.totalCount}` : "0";

  const handleAddToCart = (offerId: string | number) => {
    if (!user && onAuthClick) {
      onAuthClick();
      return;
    }
    add(offerId);
  };

  return (
    <header className="shrink-0 z-40 border-b glass glass-strong">
      {/* Desktop Header */}
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

            {/* Search and Filters */}
            {filters !== undefined && (
              <div className="hidden flex-1 flex-col gap-2 md:flex">
                <div className="flex items-center gap-2">
                  <div className="relative flex flex-1 items-center gap-3 rounded-full glass glass-subtle px-4 py-2 shadow-vilka-soft">
                    <Search className="h-4 w-4 text-foreground-muted" />
                    <input
                      ref={search.searchInputRef}
                      type="text"
                      placeholder="Найти ресторан или блюдо..."
                      value={search.searchQuery}
                      onChange={(e) => search.setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (search.searchResults.length > 0) {
                          search.setIsSearchResultsOpen(true);
                        }
                      }}
                      className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-foreground-muted"
                      data-search-input
                    />
                    {search.isSearching && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                    )}
                    {search.isSearchResultsOpen && getItemId && getCategoryId && getSubcategoryId && (
                      <div data-search-results>
                        <SearchResults
                          results={search.searchResults}
                          query={search.searchQuery}
                          hint={search.searchHint}
                          error={search.searchError}
                          onClose={() => search.setIsSearchResultsOpen(false)}
                          onSelectItem={onSearchResultSelect || (() => {})}
                          getItemId={getItemId}
                          getCategoryId={getCategoryId}
                          getSubcategoryId={getSubcategoryId}
                        />
                      </div>
                    )}
                  </div>
                  {/* Filter button */}
                  {onFiltersChange && onResetFilters && (
                    <CatalogFilters filters={filters} onFiltersChange={onFiltersChange} onReset={onResetFilters} />
                  )}
                </div>
                {/* Active filter chips */}
                {onRemoveFilter && <ActiveFilterChips filters={filters} onRemoveFilter={onRemoveFilter} />}
              </div>
            )}

            {/* Search only (no filters) */}
            {filters === undefined && (
              <div className="hidden flex-1 md:flex">
                <div className="relative flex flex-1 items-center gap-3 rounded-full glass glass-subtle px-4 py-2 shadow-vilka-soft">
                  <Search className="h-4 w-4 text-foreground-muted" />
                  <input
                    ref={search.searchInputRef}
                    type="text"
                    placeholder="Найти ресторан или блюдо..."
                    value={search.searchQuery}
                    onChange={(e) => search.setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (search.searchResults.length > 0) {
                        search.setIsSearchResultsOpen(true);
                      }
                    }}
                    className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-foreground-muted"
                    data-search-input
                  />
                  {search.isSearching && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                  )}
                  {search.isSearchResultsOpen && getItemId && getCategoryId && getSubcategoryId && (
                    <div data-search-results>
                      <SearchResults
                        results={search.searchResults}
                        query={search.searchQuery}
                        hint={search.searchHint}
                        error={search.searchError}
                        onClose={() => search.setIsSearchResultsOpen(false)}
                        onSelectItem={onSearchResultSelect || (() => {})}
                        getItemId={getItemId}
                        getCategoryId={getCategoryId}
                        getSubcategoryId={getSubcategoryId}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              {/* Address button */}
              {user && onAddressClick && (
                <button
                  type="button"
                  onClick={onAddressClick}
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
                        {onAssistantClick && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMoreMenuOpen(false);
                              // Use setTimeout to ensure state update happens after click handler
                              setTimeout(() => {
                                onAssistantClick();
                              }, 0);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Чат‑бот</span>
                          </button>
                        )}
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
                  onClick={onAuthClick}
                  className="hidden items-center gap-2 rounded-full glass glass-subtle px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/20 md:flex"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Войти</span>
                </button>
              )}

              {/* Cart */}
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
                          const isSoldOut = (((offerStocks[offer.id] ?? offer.stock) ?? 0) as number) <= 0;
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

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 bg-transparent px-4 pt-3 pb-2 dark:bg-background">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-light shadow-vilka-soft">
              <span className="text-base font-bold text-brand-dark">V</span>
            </div>
          </Link>

          {/* Address button */}
          {user && onAddressClick && (
            <button
              type="button"
              onClick={onAddressClick}
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
                    {onAssistantClick && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMoreMenuOpen(false);
                          // Use setTimeout to ensure state update happens after click handler
                          setTimeout(() => {
                            onAssistantClick();
                          }, 0);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Чат‑бот</span>
                      </button>
                    )}
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
              onClick={onAuthClick}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              <User className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMiniCartOpen((v) => !v)}
            className="flex h-8 items-center justify-center rounded-full bg-brand px-3 text-[11px] font-semibold text-white shadow-md shadow-brand/30 hover:bg-brand-dark"
          >
            {cartButtonLabel}
          </button>
        </div>

        {/* Mobile Search and Filters */}
        <div className="sticky top-0 z-30 bg-background/95 glass glass-strong">
          <div className="mx-auto max-w-7xl px-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center gap-3 rounded-full glass glass-subtle px-4 py-2 shadow-vilka-soft">
                <Search className="h-4 w-4 text-foreground-muted" />
                <input
                  ref={search.searchInputRef}
                  type="text"
                  placeholder="Найти ресторан или блюдо..."
                  value={search.searchQuery}
                  onChange={(e) => search.setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (search.searchResults.length > 0) {
                      search.setIsSearchResultsOpen(true);
                    }
                  }}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-muted"
                  data-search-input
                />
                {search.isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                )}
                {search.isSearchResultsOpen && getItemId && getCategoryId && getSubcategoryId && (
                  <div data-search-results>
                    <SearchResults
                      results={search.searchResults}
                      query={search.searchQuery}
                      hint={search.searchHint}
                      error={search.searchError}
                      onClose={() => search.setIsSearchResultsOpen(false)}
                      onSelectItem={onSearchResultSelect || (() => {})}
                      getItemId={getItemId}
                      getCategoryId={getCategoryId}
                      getSubcategoryId={getSubcategoryId}
                    />
                  </div>
                )}
              </div>
              {/* Filter button for mobile */}
              {filters !== undefined && onFiltersChange && onResetFilters && (
                <CatalogFilters filters={filters} onFiltersChange={onFiltersChange} onReset={onResetFilters} />
              )}
            </div>
            {/* Active filter chips for mobile */}
            {filters !== undefined && onRemoveFilter && (
              <div className="mt-2">
                <ActiveFilterChips filters={filters} onRemoveFilter={onRemoveFilter} />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

