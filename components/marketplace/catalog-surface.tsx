import Link from "next/link";
import { ChevronRightIcon, SearchXIcon } from "lucide-react";

import { MarketplaceCatalogControls } from "@/components/marketplace/catalog-controls";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { ProgressiveProductGrid } from "@/components/marketplace/progressive-product-grid";
import type { MarketplaceCatalogPageData } from "@/src/modules/marketplace/catalog";
import type { MarketplaceCatalogFilters } from "@/src/modules/marketplace/catalog-filters";

function getContextDescription(data: MarketplaceCatalogPageData) {
  if (data.context?.kind === "category") {
    return data.context.path;
  }

  if (data.context?.kind === "brand") {
    return `Browse all ${data.context.name} products available from Jurgens Energy.`;
  }

  return "Browse LPG cylinders, exchange-supported options, and gas accessories.";
}

function getBaseHref(data: MarketplaceCatalogPageData) {
  if (data.context?.kind === "category") {
    return `/categories/${data.context.slug}`;
  }

  if (data.context?.kind === "brand") {
    return `/brands/${data.context.slug}`;
  }

  return "/products";
}

export function MarketplaceCatalogSurface({
  data,
  filters,
}: {
  data: MarketplaceCatalogPageData;
  filters: MarketplaceCatalogFilters;
}) {
  if (!data.context) {
    return null;
  }

  const title = data.context.name;
  const feedKey = JSON.stringify({ context: data.context, filters });
  const controlsData = {
    context: data.context,
    currencyCode: data.currencyCode,
    facets: data.facets,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip bg-white pb-8 dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:dark:border-white/10">
          <div className="mx-auto w-full py-4 sm:px-6 sm:py-7 lg:px-10">
            <header className="px-3 pb-5 sm:px-0 sm:pb-7">
              <nav
                aria-label="Catalog breadcrumbs"
                className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#777770] dark:text-[#aaa9a1] sm:text-xs"
              >
                <Link className="hover:text-[#ff5a1f]" href="/">
                  Home
                </Link>
                <ChevronRightIcon className="size-3.5 shrink-0" />
                {data.context?.kind !== "all" ? (
                  <>
                    <Link className="hover:text-[#ff5a1f]" href="/products">
                      Products
                    </Link>
                    <ChevronRightIcon className="size-3.5 shrink-0" />
                  </>
                ) : null}
                <span className="truncate text-[#1a1a1a] dark:text-[#e1e1da]">
                  {title}
                </span>
              </nav>
              <h1 className="mt-3 text-[28px] font-black leading-tight sm:text-[38px]">
                {title}
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#666660] dark:text-[#aaa9a1] sm:text-sm">
                {getContextDescription(data)}
              </p>
            </header>

            <MarketplaceCatalogControls data={controlsData} filters={filters}>
              {data.products.length > 0 ? (
                <ProgressiveProductGrid
                  context={data.context}
                  filters={filters}
                  initialPage={data.page}
                  initialProducts={data.products}
                  initialTotalCount={data.totalCount}
                  initialTotalPages={data.totalPages}
                  key={feedKey}
                />
              ) : (
                <section className="grid min-h-[320px] place-items-center border-y border-[#e8e8e2] px-5 py-10 text-center dark:border-white/10 sm:rounded-md sm:border">
                  <div className="max-w-sm">
                    <SearchXIcon className="mx-auto size-8 text-[#ff5a1f]" />
                    <h2 className="mt-4 text-lg font-black">No products found</h2>
                    <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
                      Clear the current filters or try a broader search.
                    </p>
                    <Link
                      className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-[#d8d8d1] px-3 text-sm font-semibold transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15"
                      href={getBaseHref(data)}
                    >
                      Clear filters
                    </Link>
                  </div>
                </section>
              )}
            </MarketplaceCatalogControls>
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
