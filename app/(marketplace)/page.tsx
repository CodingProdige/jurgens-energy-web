import type { Metadata } from "next";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { StorefrontPageRenderer } from "@/components/marketplace/storefront-section-renderer";
import { getPublishedBlogPosts } from "@/src/modules/blog";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalog } from "@/src/modules/marketplace/catalog";
import { getPublishedStorefrontPage } from "@/src/modules/marketplace/storefront";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  createMarketplaceBusinessStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";
import { getJurgensDeliveryZones } from "@/src/modules/shipping/jurgens-delivery";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("home");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string | string[] }>;
}) {
  const [currencyContext, resolvedSearchParams] = await Promise.all([
    getCurrencyContext(),
    searchParams,
  ]);
  const brandSlug = Array.isArray(resolvedSearchParams.brand)
    ? resolvedSearchParams.brand[0]
    : resolvedSearchParams.brand;
  const [blogPosts, catalog, storefrontPage, settings, deliveryZones] = await Promise.all([
    getPublishedBlogPosts(12),
    getMarketplaceCatalog({
      brandSlug,
      currencyContext,
      limit: 36,
    }),
    getPublishedStorefrontPage(),
    getMarketplaceSettings(),
    getJurgensDeliveryZones({ activeOnly: true }),
  ]);

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceJsonLd
          data={createMarketplaceBusinessStructuredData({
            areaNames: deliveryZones.map((zone) => zone.name),
            settings,
          })}
        />
        <MarketplaceHeader />
        <main className="w-full overflow-hidden bg-white dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:rounded-b-2xl sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10 sm:dark:shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
          <StorefrontPageRenderer
            brands={catalog.brands}
            blogPosts={blogPosts}
            categories={catalog.categories}
            products={catalog.products}
            sections={storefrontPage.sections}
          />
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
