import { Suspense } from "react";
import CatalogPageClient from "../_components/CatalogPageClient";
import { getCatalogData } from "@/modules/catalog/getCatalogData";

export const revalidate = 0; // Temporarily disable cache to see new items immediately

async function CatalogPageContent() {
  const catalog = await getCatalogData();
  return <CatalogPageClient catalog={catalog} />;
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Загрузка...</div>}>
      <CatalogPageContent />
    </Suspense>
  );
}

