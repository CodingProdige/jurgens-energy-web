import type { Metadata } from "next";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getBusinessVatStatus } from "@/src/modules/business-information";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalogPage } from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";
import { getActiveMarketplaceSaleCampaigns } from "@/src/modules/marketplace/sales";
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
  const [currencyContext, resolvedSearchParams, saleCampaigns] = await Promise.all([
    getCurrencyContext(),
    searchParams,
    getActiveMarketplaceSaleCampaigns(),
  ]);
  const parsedFilters = parseMarketplaceCatalogFilters(resolvedSearchParams);
  const selectedSaleCampaign = parsedFilters.campaignId
    ? saleCampaigns.find(
        (campaign) => campaign.id === parsedFilters.campaignId,
      ) ?? null
    : null;
  const filters = {
    ...parsedFilters,
    campaignId: selectedSaleCampaign?.id ?? null,
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
      saleCampaigns={saleCampaigns}
      selectedSaleCampaign={selectedSaleCampaign}
    />
  );
}
