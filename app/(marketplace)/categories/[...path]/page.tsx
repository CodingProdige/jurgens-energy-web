import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { MarketplaceCatalogSurface } from "@/components/marketplace/catalog-surface";
import { getCurrencyContext } from "@/src/modules/currency/server";
import {
  getMarketplaceCatalogPage,
  getMarketplaceCategories,
  type MarketplaceCategorySummary,
} from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";
import { createMarketplaceDynamicPageMetadata } from "@/src/modules/marketplace/dynamic-page-metadata";

type CategoryRouteParams = { path: string[] };

function resolveCategory(
  categories: MarketplaceCategorySummary[],
  pathSegments: string[],
) {
  const requestedPath = pathSegments.join("/");
  const exactMatch = categories.find((category) => category.path === requestedPath);

  if (exactMatch) {
    return { category: exactMatch, isLegacySlug: false };
  }

  if (pathSegments.length === 1) {
    const slugMatches = categories.filter(
      (category) => category.slug === pathSegments[0],
    );

    if (slugMatches.length === 1) {
      return { category: slugMatches[0], isLegacySlug: true };
    }
  }

  return { category: null, isLegacySlug: false };
}

function createRedirectHref(
  categoryPath: string,
  searchParams: MarketplaceCatalogSearchParams,
) {
  const redirectSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    const values = Array.isArray(value) ? value : value ? [value] : [];

    for (const item of values) {
      redirectSearchParams.append(key, item);
    }
  }

  const query = redirectSearchParams.toString();

  return `/categories/${categoryPath}${query ? `?${query}` : ""}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryRouteParams>;
}): Promise<Metadata> {
  const { path } = await params;
  const { category } = resolveCategory(await getMarketplaceCategories(), path);

  if (!category) {
    return {
      title: "Category",
      description: "Shop Jurgens Energy products.",
    };
  }

  return createMarketplaceDynamicPageMetadata({
    description: `Browse ${category.name} from Jurgens Energy. Compare ${category.productCount} current ${category.productCount === 1 ? "product" : "products"}, prices, stock and available delivery methods before ordering online.`,
    image: category.firstProductImageUrl
      ? {
          alt: `${category.name} products`,
          url: category.firstProductImageUrl,
        }
      : null,
    path: `/categories/${category.path}`,
    title: category.name,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<CategoryRouteParams>;
  searchParams: Promise<MarketplaceCatalogSearchParams>;
}) {
  const [{ path }, resolvedSearchParams, currencyContext, categories] =
    await Promise.all([
      params,
      searchParams,
      getCurrencyContext(),
      getMarketplaceCategories(),
    ]);
  const { category, isLegacySlug } = resolveCategory(categories, path);

  if (!category) {
    notFound();
  }

  if (isLegacySlug) {
    permanentRedirect(createRedirectHref(category.path, resolvedSearchParams));
  }

  const filters = {
    ...parseMarketplaceCatalogFilters(resolvedSearchParams),
    categoryPaths: [],
  };
  const data = await getMarketplaceCatalogPage({
    accumulate: true,
    categoryPath: category.path,
    currencyContext,
    filters,
  });

  if (!data.context) {
    notFound();
  }

  return <MarketplaceCatalogSurface data={data} filters={filters} />;
}
