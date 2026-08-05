import type { Metadata } from "next";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getBusinessVatStatus } from "@/src/modules/business-information";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalogPage } from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";
import { getPriceTaxDisclosure } from "@/src/modules/tax/vat-display";

export const metadata: Metadata = {
  title: "Sale",
  description: "Shop current sale products from Jurgens Energy.",
};

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceCatalogSearchParams>;
}) {
  const [currencyContext, resolvedSearchParams] = await Promise.all([
    getCurrencyContext(),
    searchParams,
  ]);
  const filters = {
    ...parseMarketplaceCatalogFilters(resolvedSearchParams),
    onSale: true,
  };
  const [data, vatStatus] = await Promise.all([
    getMarketplaceCatalogPage({
      accumulate: true,
      currencyContext,
      filters,
    }),
    getBusinessVatStatus(),
  ]);

  return (
    <MarketplaceCatalogSurface
      data={data}
      filters={filters}
      priceTaxDisclosure={getPriceTaxDisclosure(vatStatus)}
    />
  );
}
