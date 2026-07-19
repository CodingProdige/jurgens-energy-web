import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getCurrencyContext } from "@/src/modules/currency/server";
import {
  getMarketplaceBrands,
  getMarketplaceCatalogPage,
} from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";
import { createMarketplaceDynamicPageMetadata } from "@/src/modules/marketplace/dynamic-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = (await getMarketplaceBrands()).find((item) => item.slug === slug);

  if (!brand) {
    return {
      title: "Brand",
      description: "Shop Jurgens Energy products by brand.",
    };
  }

  return createMarketplaceDynamicPageMetadata({
    description: `Shop ${brand.name} products from Jurgens Energy. Compare ${brand.productCount} current ${brand.productCount === 1 ? "option" : "options"}, prices, stock and available delivery methods online.`,
    image: brand.firstProductImageUrl
      ? {
          alt: `${brand.name} products`,
          url: brand.firstProductImageUrl,
        }
      : brand.logoUrl
        ? {
            alt: brand.name,
            url: brand.logoUrl,
          }
        : null,
    path: `/brands/${brand.slug}`,
    title: `${brand.name} Products`,
  });
}

export default async function BrandPage({
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
    brandSlugs: [],
  };
  const data = await getMarketplaceCatalogPage({
    accumulate: true,
    brandSlug: slug,
    currencyContext,
    filters,
  });

  if (!data.context) {
    notFound();
  }

  return <MarketplaceCatalogSurface data={data} filters={filters} />;
}
