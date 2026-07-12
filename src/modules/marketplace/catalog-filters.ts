import { z } from "zod";

export const marketplaceCatalogSortValues = [
  "featured",
  "best-selling",
  "newest",
  "price-asc",
  "price-desc",
] as const;

export type MarketplaceCatalogSort =
  (typeof marketplaceCatalogSortValues)[number];

export type MarketplaceCatalogFilters = {
  brandSlugs: string[];
  categorySlugs: string[];
  exchangeSupported: boolean;
  inStock: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  onSale: boolean;
  page: number;
  query: string;
  sort: MarketplaceCatalogSort;
};

export type MarketplaceCatalogSearchParams = Record<
  string,
  string | string[] | undefined
>;

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(160);
const sortSchema = z.enum(marketplaceCatalogSortValues);

function valuesFromParam(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoolean(value: string | string[] | undefined) {
  return firstValue(value) === "1";
}

function parsePositiveNumber(value: string | string[] | undefined) {
  const parsed = z.coerce.number().nonnegative().finite().safeParse(firstValue(value));

  return parsed.success ? parsed.data : null;
}

function parsePositiveInteger(value: string | string[] | undefined) {
  const parsed = z.coerce.number().int().positive().max(10_000).safeParse(
    firstValue(value),
  );

  return parsed.success ? parsed.data : 1;
}

function parseSlugs(value: string | string[] | undefined) {
  return Array.from(
    new Set(
      valuesFromParam(value).flatMap((item) => {
        const parsed = slugSchema.safeParse(item);

        return parsed.success ? [parsed.data] : [];
      }),
    ),
  ).slice(0, 30);
}

export function parseMarketplaceCatalogFilters(
  searchParams: MarketplaceCatalogSearchParams,
): MarketplaceCatalogFilters {
  const parsedSort = sortSchema.safeParse(firstValue(searchParams.sort));
  const query = String(firstValue(searchParams.q) ?? "").trim().slice(0, 120);
  const minPrice = parsePositiveNumber(searchParams.min);
  const maxPrice = parsePositiveNumber(searchParams.max);

  return {
    brandSlugs: parseSlugs(searchParams.brand),
    categorySlugs: parseSlugs(searchParams.category),
    exchangeSupported: parseBoolean(searchParams.exchange),
    inStock: parseBoolean(searchParams.stock),
    maxPrice:
      minPrice !== null && maxPrice !== null && maxPrice < minPrice
        ? minPrice
        : maxPrice,
    minPrice,
    onSale: parseBoolean(searchParams.sale),
    page: parsePositiveInteger(searchParams.page),
    query,
    sort: parsedSort.success ? parsedSort.data : "featured",
  };
}

export function getMarketplaceCatalogActiveFilterCount(
  filters: MarketplaceCatalogFilters,
) {
  return (
    filters.brandSlugs.length +
    filters.categorySlugs.length +
    Number(filters.exchangeSupported) +
    Number(filters.inStock) +
    Number(filters.onSale) +
    Number(filters.minPrice !== null || filters.maxPrice !== null)
  );
}

export function createMarketplaceCatalogSearchParams(
  filters: MarketplaceCatalogFilters,
) {
  const searchParams = new URLSearchParams();

  if (filters.query) {
    searchParams.set("q", filters.query);
  }

  for (const categorySlug of filters.categorySlugs) {
    searchParams.append("category", categorySlug);
  }

  for (const brandSlug of filters.brandSlugs) {
    searchParams.append("brand", brandSlug);
  }

  if (filters.inStock) {
    searchParams.set("stock", "1");
  }

  if (filters.exchangeSupported) {
    searchParams.set("exchange", "1");
  }

  if (filters.onSale) {
    searchParams.set("sale", "1");
  }

  if (filters.minPrice !== null) {
    searchParams.set("min", String(filters.minPrice));
  }

  if (filters.maxPrice !== null) {
    searchParams.set("max", String(filters.maxPrice));
  }

  if (filters.sort !== "featured") {
    searchParams.set("sort", filters.sort);
  }

  if (filters.page > 1) {
    searchParams.set("page", String(filters.page));
  }

  return searchParams;
}
