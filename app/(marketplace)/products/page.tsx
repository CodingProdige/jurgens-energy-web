import type { Metadata } from "next";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalogPage } from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("products");
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceCatalogSearchParams>;
}) {
  const [currencyContext, resolvedSearchParams] = await Promise.all([
    getCurrencyContext(),
    searchParams,
  ]);
  const filters = parseMarketplaceCatalogFilters(resolvedSearchParams);
  const data = await getMarketplaceCatalogPage({
    accumulate: true,
    currencyContext,
    filters,
  });

  return <MarketplaceCatalogSurface data={data} filters={filters} />;
}
