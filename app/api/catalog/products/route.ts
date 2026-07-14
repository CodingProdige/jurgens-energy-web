import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalogPage } from "@/src/modules/marketplace/catalog";
import {
  parseMarketplaceCatalogFilters,
  type MarketplaceCatalogSearchParams,
} from "@/src/modules/marketplace/catalog-filters";

const contextSlugSchema = z.string().regex(/^[a-z0-9-]+$/).max(160).optional();
const contextCategoryPathSchema = z
  .string()
  .regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/)
  .max(760)
  .optional();

function toCatalogSearchParams(searchParams: URLSearchParams) {
  const result: MarketplaceCatalogSearchParams = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }

  return result;
}

export async function GET(request: NextRequest) {
  const categoryPathResult = contextCategoryPathSchema.safeParse(
    request.nextUrl.searchParams.get("contextCategoryPath") ?? undefined,
  );
  const brandSlugResult = contextSlugSchema.safeParse(
    request.nextUrl.searchParams.get("contextBrand") ?? undefined,
  );

  if (
    !categoryPathResult.success ||
    !brandSlugResult.success ||
    (categoryPathResult.data && brandSlugResult.data)
  ) {
    return Response.json(
      { error: "Invalid catalog context." },
      { status: 400 },
    );
  }

  const parsedFilters = parseMarketplaceCatalogFilters(
    toCatalogSearchParams(request.nextUrl.searchParams),
  );
  const filters = {
    ...parsedFilters,
    brandSlugs: brandSlugResult.data ? [] : parsedFilters.brandSlugs,
    categoryPaths: categoryPathResult.data ? [] : parsedFilters.categoryPaths,
  };
  const currencyContext = await getCurrencyContext();
  const data = await getMarketplaceCatalogPage({
    brandSlug: brandSlugResult.data,
    categoryPath: categoryPathResult.data,
    currencyContext,
    filters,
  });

  if (!data.context) {
    return Response.json({ error: "Catalog context was not found." }, { status: 404 });
  }

  return Response.json(
    {
      page: data.page,
      products: data.products,
      totalCount: data.totalCount,
      totalPages: data.totalPages,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
