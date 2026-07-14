"use client";

import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import type {
  MarketplaceCatalogPageContext,
  MarketplaceProductCard as MarketplaceProductCardData,
} from "@/src/modules/marketplace/catalog";
import {
  createMarketplaceCatalogSearchParams,
  type MarketplaceCatalogFilters,
} from "@/src/modules/marketplace/catalog-filters";

type CatalogBatchResponse = {
  page: number;
  products: MarketplaceProductCardData[];
  totalCount: number;
  totalPages: number;
};

function ProductCardSkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-[5px] border border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04] sm:rounded-md">
      <div className="aspect-square animate-pulse bg-[#ecece6] dark:bg-white/10" />
      <div className="grid gap-2 p-2 sm:p-3">
        <div className="h-3 w-4/5 animate-pulse rounded-sm bg-[#e4e4de] dark:bg-white/10" />
        <div className="h-2.5 w-2/5 animate-pulse rounded-sm bg-[#ecece6] dark:bg-white/10" />
        <div className="h-5 w-3/5 animate-pulse rounded-sm bg-[#e4e4de] dark:bg-white/10" />
      </div>
    </div>
  );
}

function isCatalogBatchResponse(value: unknown): value is CatalogBatchResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<CatalogBatchResponse>;

  return (
    Number.isInteger(payload.page) &&
    Array.isArray(payload.products) &&
    Number.isInteger(payload.totalCount) &&
    Number.isInteger(payload.totalPages)
  );
}

function abortCatalogRequest(controller: AbortController | null) {
  if (!controller || controller.signal.aborted) {
    return;
  }

  controller.abort(new DOMException("Catalog batch cancelled.", "AbortError"));
}

export function ProgressiveProductGrid({
  context,
  filters,
  initialPage,
  initialProducts,
  initialTotalCount,
  initialTotalPages,
}: {
  context: MarketplaceCatalogPageContext;
  filters: MarketplaceCatalogFilters;
  initialPage: number;
  initialProducts: MarketplaceProductCardData[];
  initialTotalCount: number;
  initialTotalPages: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [loadedPage, setLoadedPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [supportsAutomaticLoading, setSupportsAutomaticLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const hasMore = loadedPage < totalPages;

  const updateBrowserPage = useCallback(
    (page: number) => {
      const searchParams = createMarketplaceCatalogSearchParams({
        ...filters,
        page,
      });
      const href = searchParams.size
        ? `${window.location.pathname}?${searchParams}`
        : window.location.pathname;

      window.history.replaceState(window.history.state, "", href);
    },
    [filters],
  );

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || loadedPage >= totalPages) {
      return;
    }

    const nextPage = loadedPage + 1;
    const searchParams = createMarketplaceCatalogSearchParams({
      ...filters,
      page: nextPage,
    });

    if (context.kind === "category") {
      searchParams.set("contextCategoryPath", context.path);
    } else if (context.kind === "brand") {
      searchParams.set("contextBrand", context.slug);
    }

    loadingRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    abortCatalogRequest(abortControllerRef.current);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`/api/catalog/products?${searchParams}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Catalog batch request failed.");
      }

      const payload: unknown = await response.json();

      if (!isCatalogBatchResponse(payload)) {
        throw new Error("Catalog batch response was invalid.");
      }

      setProducts((currentProducts) => {
        const productsById = new Map(
          currentProducts.map((product) => [product.id, product]),
        );

        for (const product of payload.products) {
          productsById.set(product.id, product);
        }

        return Array.from(productsById.values());
      });
      setLoadedPage(payload.page);
      setTotalCount(payload.totalCount);
      setTotalPages(payload.totalPages);
      updateBrowserPage(payload.page);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setLoadError("More products could not be loaded. Try again.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [context, filters, loadedPage, totalPages, updateBrowserPage]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setSupportsAutomaticLoading(false);
      return;
    }

    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore || loadError) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage();
        }
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadError, loadNextPage]);

  useEffect(
    () => () => {
      abortCatalogRequest(abortControllerRef.current);
    },
    [],
  );

  const remainingCount = Math.max(0, totalCount - products.length);
  const skeletonCount = Math.min(8, remainingCount || 8);

  return (
    <div aria-busy={isLoading} className="min-w-0">
      <section className="grid w-full min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] items-start gap-1.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <MarketplaceProductCard key={product.id} product={product} />
        ))}
        {isLoading
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <ProductCardSkeleton key={`catalog-skeleton-${index}`} />
            ))
          : null}
      </section>

      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      <div aria-live="polite" className="mt-5 grid min-h-10 place-items-center px-3">
        {isLoading ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#666660] dark:text-[#aaa9a1]">
            <LoaderCircleIcon className="size-4 animate-spin text-[#ff5a1f]" />
            Loading more products
          </span>
        ) : null}

        {hasMore && (loadError || !supportsAutomaticLoading) ? (
          <div className="grid justify-items-center gap-2">
            {loadError ? (
              <p className="text-xs text-red-600 dark:text-red-300">{loadError}</p>
            ) : null}
            <Button
              className="h-9 rounded-md border-[#d8d8d1] bg-white px-4 text-sm shadow-none hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:bg-white/[0.04]"
              onClick={() => void loadNextPage()}
              type="button"
              variant="outline"
            >
              <RefreshCwIcon className="size-4" />
              Load more
            </Button>
          </div>
        ) : null}

        {hasMore && !loadError && supportsAutomaticLoading && !isLoading ? (
          <Button
            className="sr-only focus:not-sr-only"
            onClick={() => void loadNextPage()}
            type="button"
            variant="outline"
          >
            Load more products
          </Button>
        ) : null}
      </div>
    </div>
  );
}
