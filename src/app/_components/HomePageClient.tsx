"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, MapPin, ShoppingBag } from "lucide-react";
import AnonymousOfferCard from "@/components/AnonymousOfferCard";
import BrandedOfferCard from "@/components/BrandedOfferCard";
import AddressModal from "@/components/AddressModal";
import AuthModal from "@/components/AuthModal";
import AIAssistantModal from "@/components/AIAssistantModal";
import { CategoriesSidebar } from "@/components/CategoriesSidebar";
import { HorizontalCarousel } from "@/components/HorizontalCarousel";
import { TopBar } from "@/components/TopBar";
import { CartProvider, useCart } from "@/modules/cart/cartContext";
import type { Offer, CatalogData, CategoryId, SubcategoryId, BaseItemId } from "@/modules/catalog/types";
import { apiClient, devError } from "@/lib/apiClient";

type HomeCollection = {
  id: string;
  title: string;
  items: Offer[];
};

type HomeData = {
  updatedAt: string;
  collections: HomeCollection[];
};

type User = {
  id: number;
  phone: string;
  role: string;
  telegram?: { username?: string | null; firstName?: string | null; lastName?: string | null } | null;
};

function CollectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-48 rounded-lg bg-skeleton-base animate-pulse dark:bg-white/10" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-64 h-64 rounded-2xl border border-border bg-skeleton-base animate-pulse dark:bg-white/10 dark:border-white/10"
          />
        ))}
      </div>
    </div>
  );
}

type HomePageContentProps = {
  homeData: HomeData | null;
  isLoading: boolean;
  catalog: CatalogData | null;
};

function HomePageContent({ homeData, isLoading, catalog }: HomePageContentProps) {
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [currentAddressLabel, setCurrentAddressLabel] = useState<string>("Указать адрес доставки");
  const [user, setUser] = useState<User | null>(null);
  const { add, remove, quantities } = useCart();
  const router = useRouter();

  // Fetch user data
  useEffect(() => {
    void (async () => {
      try {
        const data = await apiClient.get<{ user?: User | null }>("/api/auth/me", {
          headers: { credentials: "include" },
        });
        setUser(data.user || null);
      } catch (err) {
        devError("[HomePage] Failed to fetch user:", err);
      }
    })();
  }, []);

  // Fetch address
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const data = await apiClient.get<{ addresses?: Array<{ is_primary?: boolean; address?: string }> }>(
          "/api/user/addresses",
          {
            headers: { credentials: "include" },
          }
        );
        const addresses = data.addresses || [];
        if (addresses.length > 0) {
          const primary = addresses.find((a) => a.is_primary) || addresses[0];
          setCurrentAddressLabel(primary.address || "Указать адрес доставки");
        }
      } catch (err) {
        // Silently ignore
      }
    })();
  }, [user]);

  const formatUpdatedTime = (updatedAt: string) => {
    const updated = new Date(updatedAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - updated.getTime()) / 60000);

    if (diffMinutes < 1) return "только что";
    if (diffMinutes === 1) return "1 минуту назад";
    if (diffMinutes < 5) return `${diffMinutes} минуты назад`;
    if (diffMinutes < 60) return `${diffMinutes} минут назад`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours === 1) return "1 час назад";
    return `${hours} часов назад`;
  };

  const handleCategoryClick = (categoryId: CategoryId) => {
    router.push(`/catalog?category=${encodeURIComponent(categoryId)}`);
  };

  const handleSubcategoryClick = (subcategoryId: SubcategoryId) => {
    router.push(`/catalog?subcategory=${encodeURIComponent(subcategoryId)}`);
  };

  // Search result selection - navigate to catalog
  const handleSearchResultSelect = (itemId: BaseItemId, categoryId: CategoryId, subcategoryId: SubcategoryId) => {
    router.push(`/catalog?category=${encodeURIComponent(categoryId)}&subcategory=${encodeURIComponent(subcategoryId)}&item=${encodeURIComponent(itemId)}`);
  };

  // Helper functions for search (map from search result IDs to catalog IDs)
  const getItemId = (menuItemId: number): BaseItemId | null => {
    if (!catalog) return null;
    const offer = catalog.offers.find((o) => o.id === String(menuItemId));
    return offer?.baseItemId || null;
  };

  const getCategoryId = (menuItemId: number): CategoryId | null => {
    const baseItemId = getItemId(menuItemId);
    if (!baseItemId || !catalog) return null;
    const baseItem = catalog.baseItems.find((bi) => bi.id === baseItemId);
    return baseItem?.categoryId || null;
  };

  const getSubcategoryId = (menuItemId: number): SubcategoryId | null => {
    const baseItemId = getItemId(menuItemId);
    if (!baseItemId || !catalog) return null;
    const baseItem = catalog.baseItems.find((bi) => bi.id === baseItemId);
    return baseItem?.subcategoryId || null;
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-transparent transition-colors dark:bg-background">
      {/* Top Bar */}
      <TopBar
        onSearchResultSelect={handleSearchResultSelect}
        getItemId={getItemId}
        getCategoryId={getCategoryId}
        getSubcategoryId={getSubcategoryId}
        user={user}
        onAuthClick={() => setIsAuthOpen(true)}
        onAssistantClick={() => setIsAssistantOpen(true)}
        currentAddressLabel={currentAddressLabel}
        onAddressClick={() => setIsAddressOpen(true)}
        catalog={catalog}
      />

      {/* Hero Section */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 pb-8">
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
              <div className="mt-2 flex flex-col gap-2">
                <button
                  onClick={() => setIsAddressOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  <MapPin className="h-4 w-4" />
                  Указать адрес доставки
                </button>
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl glass glass-subtle px-4 py-2 text-sm font-semibold text-foreground hover:bg-hover dark:hover:bg-white/20"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Открыть каталог
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content with Sidebar */}
      <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 pb-4">
        <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]">
          {/* Categories Sidebar */}
          {catalog && (
            <CategoriesSidebar
              categories={catalog.categories}
              subcategories={catalog.subcategories}
              onCategoryClick={handleCategoryClick}
              onSubcategoryClick={handleSubcategoryClick}
              compact={true}
            />
          )}

          {/* Collections Section */}
          <section className="flex min-w-0 flex-1 min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl glass p-4 shadow-vilka-soft">
            {isLoading ? (
              <div className="space-y-12">
                {[...Array(3)].map((_, i) => (
                  <CollectionSkeleton key={i} />
                ))}
              </div>
            ) : homeData && homeData.collections.length > 0 ? (
              <div className="space-y-12">
                {homeData.collections.map((collection) => (
                  <div key={collection.id} className="space-y-3">
                    <h2 className="text-xl font-bold text-foreground">{collection.title}</h2>
                    <HorizontalCarousel>
                      {collection.items.map((offer) => {
                        const quantity = quantities[offer.id] ?? 0;
                        const handleAdd = () => add(offer.id);
                        const handleRemove = () => remove(offer.id);

                        if (offer.isAnonymous) {
                          return (
                            <div key={offer.id} className="flex-shrink-0 w-64">
                              <AnonymousOfferCard
                                name={offer.menuItemName}
                                price={offer.price}
                                oldPrice={offer.oldPrice}
                                imageUrl={offer.imageUrl}
                                quantity={quantity}
                                onAdd={handleAdd}
                                onRemove={handleRemove}
                              />
                            </div>
                          );
                        } else {
                          return (
                            <div key={offer.id} className="flex-shrink-0 w-64">
                              <BrandedOfferCard
                                itemName={offer.menuItemName}
                                brand={offer.brand}
                                price={offer.price}
                                oldPrice={offer.oldPrice}
                                imageUrl={offer.imageUrl}
                                quantity={quantity}
                                onAdd={handleAdd}
                                onRemove={handleRemove}
                              />
                            </div>
                          );
                        }
                      })}
                    </HorizontalCarousel>
                  </div>
                ))}
                {homeData.updatedAt && (
                  <div className="text-center text-xs text-foreground-muted">
                    Обновлено {formatUpdatedTime(homeData.updatedAt)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-foreground-muted">Нет доступных блюд</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <AddressModal isOpen={isAddressOpen} onClose={() => setIsAddressOpen(false)} />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={async () => {
          // Refresh user data after login
          try {
            const res = await fetch("/api/auth/me", { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user || null);
            }
          } catch (err) {
            console.error("[HomePage] Failed to fetch user after login:", err);
          }
        }}
      />
      <AIAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </main>
  );
}

export default function HomePageClient() {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [homeRes, catalogRes] = await Promise.all([
          fetch("/api/home"),
          fetch("/api/catalog/data"),
        ]);

        if (homeRes.ok) {
          const homeData: HomeData = await homeRes.json();
          setHomeData(homeData);
        }

        if (catalogRes.ok) {
          const catalogData: CatalogData = await catalogRes.json();
          setCatalog(catalogData);
        }
      } catch (err) {
        console.error("[HomePage] Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  // Collect all offers from collections for CartProvider
  const allOffers: Offer[] = homeData
    ? homeData.collections.flatMap((collection) => collection.items)
    : [];

  return (
    <CartProvider offers={allOffers}>
      <HomePageContent homeData={homeData} isLoading={isLoading} catalog={catalog} />
    </CartProvider>
  );
}
