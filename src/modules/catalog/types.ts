export type CategoryId = string;
export type SubcategoryId = string;
export type BaseItemId = string;
export type OfferId = string;
export type Money = number;

export type Category = { id: CategoryId; name: string; isPromo?: boolean };

export type Subcategory = {
  id: SubcategoryId;
  name: string;
  categoryId: CategoryId;
};

export type BaseItem = {
  id: BaseItemId;
  name: string;
  description: string;
  categoryId: CategoryId;
  subcategoryId: SubcategoryId;
};

export type Offer = {
  id: OfferId;
  baseItemId: BaseItemId;
  restaurantId: number;
  isAnonymous: boolean;
  brand?: string;
  price: Money;
  oldPrice?: Money;
  tag?: string;
  etaMinutes?: number;
  imageUrl?: string | null;
  menuItemName: string;
  stock: number;
};

export type Restaurant = {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type CatalogData = {
  categories: Category[];
  subcategories: Subcategory[];
  baseItems: BaseItem[];
  offers: Offer[];
  restaurants: Restaurant[];
};

