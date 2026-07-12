import type { Metadata } from "next";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalogPage } from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";

export const metadata: Metadata = {
  title: "All Products",
  description:
    "Shop LPG cylinders, exchange-supported options, and gas accessories from Jurgens Energy.",
};

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
