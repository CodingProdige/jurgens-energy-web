import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getCurrencyContext } from "@/src/modules/currency/server";
import {
  getMarketplaceCatalogPage,
  getMarketplaceCategories,
} from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getMarketplaceCategories()).find(
    (item) => item.slug === slug,
  );

  return {
    title: category?.name ?? "Category",
    description: category
      ? `Shop ${category.name} products from Jurgens Energy.`
      : "Shop Jurgens Energy products.",
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<MarketplaceCatalogSearchParams>;
}) {
  const [{ slug }, resolvedSearchParams, currencyContext] = await Promise.all([
    params,
    searchParams,
    getCurrencyContext(),
  ]);
  const filters = {
    ...parseMarketplaceCatalogFilters(resolvedSearchParams),
    categorySlugs: [],
  };
  const data = await getMarketplaceCatalogPage({
    accumulate: true,
    categorySlug: slug,
    currencyContext,
    filters,
  });

  if (!data.context) {
    notFound();
  }

  return <MarketplaceCatalogSurface data={data} filters={filters} />;
}
