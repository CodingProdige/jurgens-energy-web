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

  return {
    title: category?.name ?? "Category",
    description: category
      ? `Shop ${category.name} products from Jurgens Energy.`
      : "Shop Jurgens Energy products.",
    ...(category
      ? { alternates: { canonical: `/categories/${category.path}` } }
      : {}),
  };
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
