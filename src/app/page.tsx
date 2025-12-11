import CatalogPageClient from "./_components/CatalogPageClient";
import { getCatalogData } from "@/modules/catalog/getCatalogData";

export const revalidate = 0; // Temporarily disable cache to see new items immediately

export default async function HomePage() {
  const catalog = await getCatalogData();
  return <CatalogPageClient catalog={catalog} />;
}

