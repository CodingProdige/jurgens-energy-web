import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  categories,
  media,
  orderItems,
  orders,
  productMedia,
  productVariants,
  products,
} from "@/src/db/schema";
import {
  convertFromZar,
  formatFromZar,
  formatRangeFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
import type { MarketplaceCatalogFilters } from "@/src/modules/marketplace/catalog-filters";
import { getMediaPublicUrl } from "@/src/modules/media/paths";

const publicProductStatuses = ["live", "active"] as const;

export type MarketplaceCategorySummary = {
  firstProductImageUrl: string | null;
  id: string;
  name: string;
  path: string;
  productCount: number;
  slug: string;
};

export type MarketplaceBrandSummary = {
  firstProductImageUrl: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
  productCount: number;
  slug: string;
};

export type MarketplaceShopMenuBrand = {
  id: string;
  logoUrl: string | null;
  name: string;
  productCount: number;
  slug: string;
};

export type MarketplaceShopMenuProduct = {
  id: string;
  imageUrl: string | null;
  slug: string;
  title: string;
};

export type MarketplaceShopMenuCategory = {
  brands: MarketplaceShopMenuBrand[];
  children: MarketplaceShopMenuCategory[];
  firstProductImageUrl: string | null;
  id: string;
  name: string;
  path: string;
  productCount: number;
  slug: string;
};

export type MarketplaceShopMenuData = {
  categories: MarketplaceShopMenuCategory[];
  exchangeableLpgProducts: MarketplaceShopMenuProduct[];
  totalProductCount: number;
};

export type MarketplaceProductCard = {
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  category: MarketplaceCategorySummary | null;
  coverImageUrl: string | null;
  compareAtPriceLabel: string | null;
  discountLabel: string | null;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  hasExchangeOption: boolean;
  id: string;
  inStock: boolean;
  isOnSale: boolean;
  priceLabel: string;
  quickAddVariantId: string | null;
  shortDescription: string | null;
  slug: string;
  title: string;
  variantCount: number;
};

export type MarketplaceProductOptionSchema = {
  name: string;
  values: string[];
};

export type MarketplaceVariant = {
  compareAtPrice: string | null;
  exchangeAcceptedReturnBrands: string[];
  exchangeConfirmationText: string | null;
  exchangeEmptyCylinderSize: string | null;
  id: string;
  imageUrl: string | null;
  inStock: boolean;
  notes: string | null;
  optionValues: string[];
  price: string;
  requiresExchangeEmpty: boolean;
  sku: string;
  soldQuantity: number;
  stockOnHand: number;
  title: string;
};

export type MarketplaceProductDetail = MarketplaceProductCard & {
  barcode: string | null;
  description: string | null;
  fullDescription: string | null;
  imageUrls: string[];
  optionSchema: MarketplaceProductOptionSchema[];
  updatedAt: Date;
  variants: MarketplaceVariant[];
};

export type MarketplaceSitemapEntries = {
  brands: Array<{ slug: string; updatedAt: Date }>;
  categories: Array<{ path: string; updatedAt: Date }>;
  products: Array<{ slug: string; updatedAt: Date }>;
};

function latestDate(first: Date, second: Date) {
  return first.getTime() >= second.getTime() ? first : second;
}

function toMediaUrl(relativePath: string | null, thumbnailRelativePath: string | null) {
  const path = thumbnailRelativePath ?? relativePath;

  return path ? getMediaPublicUrl(path) : null;
}

function getVariantInStock(variant: {
  continueSellingOutOfStock: boolean;
  stockOnHand: number;
}) {
  return variant.continueSellingOutOfStock || variant.stockOnHand > 0;
}

function getPriceLabel(
  variants: Array<{ price: string }>,
  currencyContext: CurrencyContext,
) {
  return formatRangeFromZar(
    variants.map((variant) => variant.price),
    currencyContext,
  );
}

function getProductCardSaleData(
  variants: Array<{ compareAtPrice: string | null; price: string }>,
  currencyContext: CurrencyContext,
) {
  const saleVariants = variants.filter((variant) => {
    const price = Number(variant.price);
    const compareAtPrice = Number(variant.compareAtPrice);

    return (
      Number.isFinite(price) &&
      Number.isFinite(compareAtPrice) &&
      price > 0 &&
      compareAtPrice > price
    );
  });
  const representativeVariant = [...variants]
    .filter((variant) => Number.isFinite(Number(variant.price)))
    .sort((first, second) => Number(first.price) - Number(second.price))[0];
  const price = Number(representativeVariant?.price);
  const compareAtPrice = Number(representativeVariant?.compareAtPrice);

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(compareAtPrice) ||
    price <= 0 ||
    compareAtPrice <= price
  ) {
    return {
      compareAtPriceLabel: null,
      discountLabel: null,
      isOnSale: saleVariants.length > 0,
    };
  }

  const discountPercent = Math.max(
    1,
    Math.round(((compareAtPrice - price) / compareAtPrice) * 100),
  );

  return {
    compareAtPriceLabel: formatFromZar(compareAtPrice, currencyContext),
    discountLabel: `${discountPercent}% off`,
    isOnSale: true,
  };
}

function getQuickAddVariantId(
  variants: Array<{
    continueSellingOutOfStock: boolean;
    id: string;
    requiresExchangeEmpty: boolean;
    stockOnHand: number;
  }>,
) {
  if (variants.length !== 1) {
    return null;
  }

  const [variant] = variants;

  return !variant.requiresExchangeEmpty && getVariantInStock(variant)
    ? variant.id
    : null;
}

async function getPublicProductsBaseRows() {
  return db
    .select({
      barcode: products.barcode,
      brandId: brands.id,
      brandLogoRelativePath: media.relativePath,
      brandLogoThumbnailRelativePath: media.thumbnailRelativePath,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryPath: categories.path,
      categorySlug: categories.slug,
      description: products.description,
      fulfillmentMode: products.fulfillmentMode,
      fullDescription: products.fullDescription,
      id: products.id,
      optionSchema: products.optionSchema,
      shortDescription: products.shortDescription,
      slug: products.slug,
      title: products.title,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(media, eq(media.id, brands.logoMediaId))
    .where(
      andPublicProductStatus(),
    )
    .orderBy(desc(products.updatedAt), asc(products.title));
}

function andPublicProductStatus() {
  return or(
    eq(products.status, publicProductStatuses[0]),
    eq(products.status, publicProductStatuses[1]),
  );
}

function toCategory(row: {
  categoryId: string | null;
  categoryName: string | null;
  categoryPath: string | null;
  categorySlug: string | null;
}): MarketplaceCategorySummary | null {
  if (!row.categoryId || !row.categoryName || !row.categoryPath || !row.categorySlug) {
    return null;
  }

  return {
    id: row.categoryId,
    firstProductImageUrl: null,
    name: row.categoryName,
    path: row.categoryPath,
    productCount: 0,
    slug: row.categorySlug,
  };
}

async function getCoverUrlsByProductId(productIds: string[]) {
  const coverByProductId = new Map<string, string | null>();

  if (productIds.length === 0) {
    return coverByProductId;
  }

  const coverRows = await db
    .select({
      productId: productMedia.productId,
      relativePath: media.relativePath,
      sortOrder: productMedia.sortOrder,
      thumbnailRelativePath: media.thumbnailRelativePath,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.sortOrder));

  for (const row of coverRows) {
    if (!coverByProductId.has(row.productId)) {
      coverByProductId.set(
        row.productId,
        toMediaUrl(row.relativePath, row.thumbnailRelativePath),
      );
    }
  }

  return coverByProductId;
}

export async function getMarketplaceCatalog({
  brandSlug,
  categorySlug,
  currencyContext,
  limit = 48,
  query,
}: {
  brandSlug?: string;
  categorySlug?: string;
  currencyContext: CurrencyContext;
  limit?: number;
  query?: string;
}) {
  const rows = await getPublicProductsBaseRows();
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const filteredRows = rows
    .filter((row) => !brandSlug || row.brandSlug === brandSlug)
    .filter((row) => !categorySlug || row.categorySlug === categorySlug)
    .filter((row) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        row.title,
        row.shortDescription,
        row.brandName,
        row.categoryPath,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    })
    .slice(0, limit);
  const productIds = filteredRows.map((row) => row.id);

  if (productIds.length === 0) {
    const [categoriesList, brandsList] = await Promise.all([
      getMarketplaceCategories(),
      getMarketplaceBrands(),
    ]);

    return {
      brands: brandsList,
      categories: categoriesList,
      products: [],
    };
  }

  const [variantRows, coverByProductId, categoriesList, brandsList] =
    await Promise.all([
      db
        .select({
          compareAtPrice: productVariants.compareAtPrice,
          continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
          id: productVariants.id,
          price: productVariants.price,
          productId: productVariants.productId,
          requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
          status: productVariants.status,
          stockOnHand: productVariants.stockOnHand,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
        .orderBy(asc(productVariants.title)),
      getCoverUrlsByProductId(productIds),
      getMarketplaceCategories(),
      getMarketplaceBrands(),
    ]);

  const variantsByProductId = new Map<
    string,
    Array<{
      compareAtPrice: string | null;
      continueSellingOutOfStock: boolean;
      id: string;
      price: string;
      requiresExchangeEmpty: boolean;
      status: string;
      stockOnHand: number;
    }>
  >();

  for (const row of variantRows) {
    if (row.status !== "active") {
      continue;
    }

    const variants = variantsByProductId.get(row.productId) ?? [];
    variants.push(row);
    variantsByProductId.set(row.productId, variants);
  }

  const productsList = filteredRows.map((row): MarketplaceProductCard => {
    const variants = variantsByProductId.get(row.id) ?? [];

    return {
      brandId: row.brandId,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      category: toCategory(row),
      coverImageUrl: coverByProductId.get(row.id) ?? null,
      fulfillmentMode: row.fulfillmentMode,
      hasExchangeOption: variants.some((variant) => variant.requiresExchangeEmpty),
      id: row.id,
      inStock: variants.some(getVariantInStock),
      priceLabel: getPriceLabel(variants, currencyContext),
      ...getProductCardSaleData(variants, currencyContext),
      quickAddVariantId: getQuickAddVariantId(variants),
      shortDescription: row.shortDescription,
      slug: row.slug,
      title: row.title,
      variantCount: variants.length,
    };
  });

  return {
    brands: brandsList,
    categories: categoriesList,
    products: productsList,
  };
}

export type MarketplaceCatalogFacetOption = {
  count: number;
  label: string;
  value: string;
};

export type MarketplaceCatalogPageContext =
  | { kind: "all"; name: "All Products"; slug: null }
  | { kind: "brand"; name: string; slug: string }
  | { kind: "category"; name: string; path: string; slug: string };

export type MarketplaceCatalogPageData = {
  context: MarketplaceCatalogPageContext | null;
  currencyCode: string;
  facets: {
    brands: MarketplaceCatalogFacetOption[];
    categories: MarketplaceCatalogFacetOption[];
    exchangeSupportedCount: number;
    inStockCount: number;
    onSaleCount: number;
    priceMaximum: number | null;
    priceMinimum: number | null;
  };
  page: number;
  pageSize: number;
  products: MarketplaceProductCard[];
  totalCount: number;
  totalPages: number;
};

type MarketplaceCatalogFilterVariant = {
  compareAtPrice: string | null;
  continueSellingOutOfStock: boolean;
  id: string;
  isActive: boolean;
  price: string;
  productId: string;
  requiresExchangeEmpty: boolean;
  status: string;
  stockOnHand: number;
};

type MarketplaceCatalogFilterRecord = {
  maximumPrice: number | null;
  minimumPrice: number | null;
  row: Awaited<ReturnType<typeof getPublicProductsBaseRows>>[number];
  soldQuantity: number;
  variants: MarketplaceCatalogFilterVariant[];
};

type MarketplaceCatalogOmittedFacet =
  | "brand"
  | "category"
  | "exchange"
  | "price"
  | "sale"
  | "stock"
  | null;

function getRecordInStock(record: MarketplaceCatalogFilterRecord) {
  return record.variants.some(getVariantInStock);
}

function getRecordExchangeSupported(record: MarketplaceCatalogFilterRecord) {
  return record.variants.some((variant) => variant.requiresExchangeEmpty);
}

function getRecordOnSale(record: MarketplaceCatalogFilterRecord) {
  return record.variants.some(
    (variant) =>
      variant.compareAtPrice !== null &&
      Number(variant.compareAtPrice) > Number(variant.price),
  );
}

function matchesCatalogRecord({
  categoryPathByFilterValue,
  context,
  currencyContext,
  filters,
  omitFacet,
  record,
}: {
  categoryPathByFilterValue: ReadonlyMap<string, string>;
  context: MarketplaceCatalogPageContext;
  currencyContext: CurrencyContext;
  filters: MarketplaceCatalogFilters;
  omitFacet: MarketplaceCatalogOmittedFacet;
  record: MarketplaceCatalogFilterRecord;
}) {
  const recordCategoryPath = record.row.categoryPath;

  if (context.kind === "category") {
    if (
      !recordCategoryPath ||
      (recordCategoryPath !== context.path &&
        !recordCategoryPath.startsWith(`${context.path}/`))
    ) {
      return false;
    }
  }

  if (context.kind === "brand" && record.row.brandSlug !== context.slug) {
    return false;
  }

  const normalizedQuery = filters.query.toLowerCase();

  if (
    normalizedQuery &&
    ![
      record.row.title,
      record.row.shortDescription,
      record.row.brandName,
      record.row.categoryPath,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery))
  ) {
    return false;
  }

  if (
    omitFacet !== "category" &&
    context.kind !== "category" &&
    filters.categoryPaths.length > 0 &&
    (!recordCategoryPath ||
      !filters.categoryPaths.some((categoryPath) => {
        const selectedCategoryPath = categoryPathByFilterValue.get(categoryPath);

        return selectedCategoryPath
          ? recordCategoryPath === selectedCategoryPath ||
              recordCategoryPath.startsWith(`${selectedCategoryPath}/`)
          : false;
      }))
  ) {
    return false;
  }

  if (
    omitFacet !== "brand" &&
    context.kind !== "brand" &&
    filters.brandSlugs.length > 0 &&
    (!record.row.brandSlug || !filters.brandSlugs.includes(record.row.brandSlug))
  ) {
    return false;
  }

  if (omitFacet !== "stock" && filters.inStock && !getRecordInStock(record)) {
    return false;
  }

  if (
    omitFacet !== "exchange" &&
    filters.exchangeSupported &&
    !getRecordExchangeSupported(record)
  ) {
    return false;
  }

  if (omitFacet !== "sale" && filters.onSale && !getRecordOnSale(record)) {
    return false;
  }

  if (omitFacet !== "price") {
    const hasMatchingVariantPrice = record.variants.some((variant) => {
      const price = convertFromZar(variant.price, currencyContext);

      return (
        (filters.minPrice === null || price >= filters.minPrice) &&
        (filters.maxPrice === null || price <= filters.maxPrice)
      );
    });

    if (
      (filters.minPrice !== null || filters.maxPrice !== null) &&
      !hasMatchingVariantPrice
    ) {
      return false;
    }
  }

  return true;
}

function sortCatalogRecords(
  records: MarketplaceCatalogFilterRecord[],
  sort: MarketplaceCatalogFilters["sort"],
) {
  return [...records].sort((first, second) => {
    if (sort === "best-selling") {
      return (
        second.soldQuantity - first.soldQuantity ||
        second.row.updatedAt.getTime() - first.row.updatedAt.getTime()
      );
    }

    if (sort === "newest") {
      return second.row.createdAt.getTime() - first.row.createdAt.getTime();
    }

    if (sort === "price-asc") {
      return (
        (first.minimumPrice ?? Number.POSITIVE_INFINITY) -
        (second.minimumPrice ?? Number.POSITIVE_INFINITY)
      );
    }

    if (sort === "price-desc") {
      return (
        (second.maximumPrice ?? Number.NEGATIVE_INFINITY) -
        (first.maximumPrice ?? Number.NEGATIVE_INFINITY)
      );
    }

    return (
      second.soldQuantity - first.soldQuantity ||
      second.row.updatedAt.getTime() - first.row.updatedAt.getTime()
    );
  });
}

export async function getMarketplaceCatalogPage({
  accumulate = false,
  brandSlug,
  categoryPath,
  categorySlug,
  currencyContext,
  filters,
  pageSize = 24,
}: {
  accumulate?: boolean;
  brandSlug?: string;
  categoryPath?: string;
  categorySlug?: string;
  currencyContext: CurrencyContext;
  filters: MarketplaceCatalogFilters;
  pageSize?: number;
}): Promise<MarketplaceCatalogPageData> {
  const [rows, categoriesList, brandsList] = await Promise.all([
    getPublicProductsBaseRows(),
    getMarketplaceCategories(),
    getMarketplaceBrands(),
  ]);
  const lockedCategory = categoryPath
    ? categoriesList.find((category) => category.path === categoryPath) ?? null
    : categorySlug
      ? categoriesList.find((category) => category.slug === categorySlug) ?? null
      : null;
  const lockedBrand = brandSlug
    ? brandsList.find((brand) => brand.slug === brandSlug) ?? null
    : null;
  const context: MarketplaceCatalogPageContext | null =
    categoryPath || categorySlug
      ? lockedCategory
        ? {
            kind: "category",
            name: lockedCategory.name,
            path: lockedCategory.path,
            slug: lockedCategory.slug,
          }
        : null
      : brandSlug
        ? lockedBrand
          ? { kind: "brand", name: lockedBrand.name, slug: lockedBrand.slug }
          : null
        : { kind: "all", name: "All Products", slug: null };

  if (!context) {
    return {
      context: null,
      currencyCode: currencyContext.currency,
      facets: {
        brands: [],
        categories: [],
        exchangeSupportedCount: 0,
        inStockCount: 0,
        onSaleCount: 0,
        priceMaximum: null,
        priceMinimum: null,
      },
      page: 1,
      pageSize,
      products: [],
      totalCount: 0,
      totalPages: 1,
    };
  }

  const productIds = rows.map((row) => row.id);
  const variantRows: MarketplaceCatalogFilterVariant[] =
    productIds.length > 0
      ? await db
          .select({
            compareAtPrice: productVariants.compareAtPrice,
            continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
            id: productVariants.id,
            isActive: productVariants.isActive,
            price: productVariants.price,
            productId: productVariants.productId,
            requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
            status: productVariants.status,
            stockOnHand: productVariants.stockOnHand,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, productIds))
      : [];
  const activeVariantRows = variantRows.filter(
    (variant) => variant.status === "active" && variant.isActive,
  );
  const salesRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productVariants.productId,
            soldQuantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
          })
          .from(orderItems)
          .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(
            and(
              inArray(productVariants.productId, productIds),
              inArray(orders.status, ["paid", "fulfilled"]),
            ),
          )
          .groupBy(productVariants.productId)
      : [];
  const soldQuantityByProductId = new Map(
    salesRows.map((row) => [row.productId, Number(row.soldQuantity) || 0]),
  );
  const variantsByProductId = new Map<string, MarketplaceCatalogFilterVariant[]>();

  for (const variant of activeVariantRows) {
    const productVariantsList = variantsByProductId.get(variant.productId) ?? [];
    productVariantsList.push(variant);
    variantsByProductId.set(variant.productId, productVariantsList);
  }

  const records = rows.map((row): MarketplaceCatalogFilterRecord => {
    const variants = variantsByProductId.get(row.id) ?? [];
    const prices = variants
      .map((variant) => Number(variant.price))
      .filter(Number.isFinite);

    return {
      maximumPrice: prices.length > 0 ? Math.max(...prices) : null,
      minimumPrice: prices.length > 0 ? Math.min(...prices) : null,
      row,
      soldQuantity: soldQuantityByProductId.get(row.id) ?? 0,
      variants,
    };
  });
  const categoryPathsBySlug = new Map<string, string[]>();

  for (const category of categoriesList) {
    const paths = categoryPathsBySlug.get(category.slug) ?? [];
    paths.push(category.path);
    categoryPathsBySlug.set(category.slug, paths);
  }

  const categoryPathByFilterValue = new Map(
    categoriesList.map((category) => [category.path, category.path]),
  );

  for (const [slug, paths] of categoryPathsBySlug) {
    if (paths.length === 1 && !categoryPathByFilterValue.has(slug)) {
      categoryPathByFilterValue.set(slug, paths[0]);
    }
  }
  const matches = (
    record: MarketplaceCatalogFilterRecord,
    omitFacet: MarketplaceCatalogOmittedFacet = null,
  ) =>
    matchesCatalogRecord({
      categoryPathByFilterValue,
      context,
      currencyContext,
      filters,
      omitFacet,
      record,
    });
  const filteredRecords = sortCatalogRecords(
    records.filter((record) => matches(record)),
    filters.sort,
  );
  const totalCount = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(filters.page, totalPages);
  const paginatedRecords = filteredRecords.slice(
    accumulate ? 0 : (page - 1) * pageSize,
    page * pageSize,
  );
  const pageProductIds = paginatedRecords.map((record) => record.row.id);
  const coverByProductId = await getCoverUrlsByProductId(pageProductIds);
  const productsList = paginatedRecords.map((record): MarketplaceProductCard => ({
    brandId: record.row.brandId,
    brandName: record.row.brandName,
    brandSlug: record.row.brandSlug,
    category: toCategory(record.row),
    coverImageUrl: coverByProductId.get(record.row.id) ?? null,
    fulfillmentMode: record.row.fulfillmentMode,
    hasExchangeOption: getRecordExchangeSupported(record),
    id: record.row.id,
    inStock: getRecordInStock(record),
    priceLabel: getPriceLabel(record.variants, currencyContext),
    ...getProductCardSaleData(record.variants, currencyContext),
    quickAddVariantId: getQuickAddVariantId(record.variants),
    shortDescription: record.row.shortDescription,
    slug: record.row.slug,
    title: record.row.title,
    variantCount: record.variants.length,
  }));
  const priceRecords = records.filter((record) => matches(record, "price"));
  const availablePrices = priceRecords
    .flatMap((record) => [record.minimumPrice, record.maximumPrice])
    .filter((price): price is number => price !== null)
    .map((price) => convertFromZar(price, currencyContext));
  const categoryFacetRecords = records.filter((record) => matches(record, "category"));
  const brandFacetRecords = records.filter((record) => matches(record, "brand"));

  return {
    context,
    currencyCode: currencyContext.currency,
    facets: {
      brands: brandsList
        .map((brand) => ({
          count: brandFacetRecords.filter((record) => record.row.brandSlug === brand.slug)
            .length,
          label: brand.name,
          value: brand.slug,
        }))
        .filter((brand) => brand.count > 0 || filters.brandSlugs.includes(brand.value)),
      categories: categoriesList
        .map((category) => ({
          count: categoryFacetRecords.filter(
            (record) =>
              record.row.categoryPath === category.path ||
              record.row.categoryPath?.startsWith(`${category.path}/`),
          ).length,
          label: category.name,
          value: category.path,
        }))
        .filter(
          (category) =>
            category.count > 0 || filters.categoryPaths.includes(category.value),
        ),
      exchangeSupportedCount: records.filter(
        (record) => matches(record, "exchange") && getRecordExchangeSupported(record),
      ).length,
      inStockCount: records.filter(
        (record) => matches(record, "stock") && getRecordInStock(record),
      ).length,
      onSaleCount: records.filter(
        (record) => matches(record, "sale") && getRecordOnSale(record),
      ).length,
      priceMaximum:
        availablePrices.length > 0 ? Math.ceil(Math.max(...availablePrices)) : null,
      priceMinimum:
        availablePrices.length > 0 ? Math.floor(Math.min(...availablePrices)) : null,
    },
    page,
    pageSize,
    products: productsList,
    totalCount,
    totalPages,
  };
}

export async function getMarketplaceCategories(): Promise<
  MarketplaceCategorySummary[]
> {
  const [categoryRows, productRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        path: categories.path,
        slug: categories.slug,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .where(eq(categories.status, "active"))
      .orderBy(asc(categories.sortOrder), asc(categories.path)),
    getPublicProductsBaseRows(),
  ]);
  const coverByProductId = await getCoverUrlsByProductId(
    productRows.map((row) => row.id),
  );
  const productMetaByCategoryId = new Map<
    string,
    { firstProductImageUrl: string | null; productCount: number }
  >();

  for (const row of productRows) {
    if (!row.categoryId) {
      continue;
    }

    const current = productMetaByCategoryId.get(row.categoryId) ?? {
      firstProductImageUrl: null,
      productCount: 0,
    };
    const firstProductImageUrl =
      current.firstProductImageUrl ?? coverByProductId.get(row.id) ?? null;

    productMetaByCategoryId.set(row.categoryId, {
      firstProductImageUrl,
      productCount: current.productCount + 1,
    });
  }

  return categoryRows.map((row) => {
    const productMeta = productMetaByCategoryId.get(row.id);

    return {
      firstProductImageUrl: productMeta?.firstProductImageUrl ?? null,
      id: row.id,
      name: row.name,
      path: row.path,
      productCount: productMeta?.productCount ?? 0,
      slug: row.slug,
    };
  });
}

export async function getMarketplaceShopMenuData(): Promise<MarketplaceShopMenuData> {
  const [categoryRows, brandRows, productRows, exchangeableVariantRows] =
    await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          parentId: categories.parentId,
          path: categories.path,
          slug: categories.slug,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(eq(categories.status, "active"))
        .orderBy(asc(categories.sortOrder), asc(categories.path)),
      db
        .select({
          id: brands.id,
          logoRelativePath: media.relativePath,
          logoThumbnailRelativePath: media.thumbnailRelativePath,
          name: brands.name,
          slug: brands.slug,
        })
        .from(brands)
        .leftJoin(media, eq(media.id, brands.logoMediaId))
        .where(eq(brands.status, "active"))
        .orderBy(asc(brands.name)),
      getPublicProductsBaseRows(),
      db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.isActive, true),
            eq(productVariants.requiresExchangeEmpty, true),
            eq(productVariants.status, "active"),
          ),
        ),
    ]);
  const coverByProductId = await getCoverUrlsByProductId(
    productRows.map((row) => row.id),
  );
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));
  const exchangeableProductIds = new Set(
    exchangeableVariantRows.map((row) => row.productId),
  );
  const childRowsByParentId = new Map<string, typeof categoryRows>();
  const brandById = new Map(brandRows.map((row) => [row.id, row]));
  const categoryMetaById = new Map<
    string,
    {
      brandProductCounts: Map<string, number>;
      firstProductImageUrl: string | null;
      productCount: number;
    }
  >();

  for (const category of categoryRows) {
    if (!category.parentId || !categoryById.has(category.parentId)) {
      continue;
    }

    const siblings = childRowsByParentId.get(category.parentId) ?? [];
    siblings.push(category);
    childRowsByParentId.set(category.parentId, siblings);
  }

  for (const product of productRows) {
    let category = product.categoryId
      ? categoryById.get(product.categoryId)
      : undefined;
    const visitedCategoryIds = new Set<string>();

    while (category && !visitedCategoryIds.has(category.id)) {
      visitedCategoryIds.add(category.id);

      const meta = categoryMetaById.get(category.id) ?? {
        brandProductCounts: new Map<string, number>(),
        firstProductImageUrl: null,
        productCount: 0,
      };

      meta.productCount += 1;
      meta.firstProductImageUrl ??= coverByProductId.get(product.id) ?? null;

      if (product.brandId && brandById.has(product.brandId)) {
        meta.brandProductCounts.set(
          product.brandId,
          (meta.brandProductCounts.get(product.brandId) ?? 0) + 1,
        );
      }

      categoryMetaById.set(category.id, meta);
      category = category.parentId
        ? categoryById.get(category.parentId)
        : undefined;
    }
  }

  const compareCategories = (
    first: (typeof categoryRows)[number],
    second: (typeof categoryRows)[number],
  ) =>
    first.sortOrder - second.sortOrder ||
    first.name.localeCompare(second.name) ||
    first.path.localeCompare(second.path);
  const compareMenuBrands = (
    first: MarketplaceShopMenuBrand,
    second: MarketplaceShopMenuBrand,
  ) =>
    second.productCount - first.productCount ||
    first.name.localeCompare(second.name);
  const toMenuBrand = (
    brandId: string,
    productCount: number,
  ): MarketplaceShopMenuBrand | null => {
    const brand = brandById.get(brandId);

    if (!brand || productCount <= 0) {
      return null;
    }

    return {
      id: brand.id,
      logoUrl: toMediaUrl(
        brand.logoRelativePath,
        brand.logoThumbnailRelativePath,
      ),
      name: brand.name,
      productCount,
      slug: brand.slug,
    };
  };
  const toMenuCategory = (
    category: (typeof categoryRows)[number],
  ): MarketplaceShopMenuCategory => {
    const meta = categoryMetaById.get(category.id) ?? {
      brandProductCounts: new Map<string, number>(),
      firstProductImageUrl: null,
      productCount: 0,
    };

    const children = (childRowsByParentId.get(category.id) ?? [])
      .sort(compareCategories)
      .map(toMenuCategory);
    const menuBrands = Array.from(meta.brandProductCounts.entries())
      .map(([brandId, productCount]) => toMenuBrand(brandId, productCount))
      .filter((brand): brand is MarketplaceShopMenuBrand => brand !== null)
      .sort(compareMenuBrands);

    return {
      brands: menuBrands,
      children,
      firstProductImageUrl: meta.firstProductImageUrl,
      id: category.id,
      name: category.name,
      path: category.path,
      productCount: meta.productCount,
      slug: category.slug,
    };
  };
  const rootCategories = categoryRows
    .filter(
      (category) =>
        !category.parentId || !categoryById.has(category.parentId),
    )
    .sort(compareCategories)
    .map(toMenuCategory);
  const lpgRootCategory =
    rootCategories.find((category) =>
      ["gas-cylinders", "lpg-cylinders"].includes(category.slug),
    ) ??
    rootCategories.find((category) => {
      const text = `${category.name} ${category.slug}`.toLowerCase();

      return text.includes("cylinder") && !text.includes("accessor");
    });
  const isInLpgCategory = (categoryId: string | null) => {
    if (!lpgRootCategory || !categoryId) {
      return false;
    }

    let category = categoryById.get(categoryId);
    const visitedCategoryIds = new Set<string>();

    while (category && !visitedCategoryIds.has(category.id)) {
      if (category.id === lpgRootCategory.id) {
        return true;
      }

      visitedCategoryIds.add(category.id);
      category = category.parentId
        ? categoryById.get(category.parentId)
        : undefined;
    }

    return false;
  };
  const exchangeableLpgProducts = productRows
    .filter((product) => {
      const productText = `${product.title} ${product.categoryName ?? ""}`.toLowerCase();
      const isCylinder = productText.includes("cylinder") || productText.includes("lpg");

      return (
        exchangeableProductIds.has(product.id) &&
        isCylinder &&
        (isInLpgCategory(product.categoryId) || !lpgRootCategory)
      );
    })
    .map((product) => ({
      id: product.id,
      imageUrl: coverByProductId.get(product.id) ?? null,
      slug: product.slug,
      title: product.title,
    }))
    .sort((first, second) => first.title.localeCompare(second.title));
  return {
    categories: rootCategories,
    exchangeableLpgProducts,
    totalProductCount: productRows.length,
  };
}

export async function getMarketplaceSitemapEntries(): Promise<MarketplaceSitemapEntries> {
  const [productRows, categoryRows, brandRows] = await Promise.all([
    getPublicProductsBaseRows(),
    db
      .select({
        id: categories.id,
        path: categories.path,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(eq(categories.status, "active")),
    db
      .select({
        id: brands.id,
        slug: brands.slug,
        updatedAt: brands.updatedAt,
      })
      .from(brands)
      .where(eq(brands.status, "active")),
  ]);
  const latestProductDateByCategoryId = new Map<string, Date>();
  const latestProductDateByBrandId = new Map<string, Date>();

  for (const row of productRows) {
    if (row.categoryId) {
      const current = latestProductDateByCategoryId.get(row.categoryId);
      latestProductDateByCategoryId.set(
        row.categoryId,
        current ? latestDate(current, row.updatedAt) : row.updatedAt,
      );
    }

    if (row.brandId) {
      const current = latestProductDateByBrandId.get(row.brandId);
      latestProductDateByBrandId.set(
        row.brandId,
        current ? latestDate(current, row.updatedAt) : row.updatedAt,
      );
    }
  }

  return {
    brands: brandRows
      .map((brand) => {
        const productUpdatedAt = latestProductDateByBrandId.get(brand.id);

        return productUpdatedAt
          ? {
              slug: brand.slug,
              updatedAt: latestDate(brand.updatedAt, productUpdatedAt),
            }
          : null;
      })
      .filter((brand): brand is { slug: string; updatedAt: Date } => Boolean(brand)),
    categories: categoryRows
      .map((category) => {
        const productUpdatedAt = latestProductDateByCategoryId.get(category.id);

        return productUpdatedAt
          ? {
              path: category.path,
              updatedAt: latestDate(category.updatedAt, productUpdatedAt),
            }
          : null;
      })
      .filter(
        (category): category is { path: string; updatedAt: Date } =>
          Boolean(category),
      ),
    products: productRows.map((product) => ({
      slug: product.slug,
      updatedAt: product.updatedAt,
    })),
  };
}

export async function getMarketplaceBrands(): Promise<
  MarketplaceBrandSummary[]
> {
  const [brandRows, productRows] = await Promise.all([
    db
      .select({
        id: brands.id,
        logoRelativePath: media.relativePath,
        logoThumbnailRelativePath: media.thumbnailRelativePath,
        name: brands.name,
        slug: brands.slug,
      })
      .from(brands)
      .leftJoin(media, eq(media.id, brands.logoMediaId))
      .where(eq(brands.status, "active"))
      .orderBy(asc(brands.name)),
    getPublicProductsBaseRows(),
  ]);
  const coverByProductId = await getCoverUrlsByProductId(
    productRows.map((row) => row.id),
  );
  const productMetaByBrandId = new Map<
    string,
    { firstProductImageUrl: string | null; productCount: number }
  >();

  for (const row of productRows) {
    if (!row.brandId) {
      continue;
    }

    const current = productMetaByBrandId.get(row.brandId) ?? {
      firstProductImageUrl: null,
      productCount: 0,
    };
    const firstProductImageUrl =
      current.firstProductImageUrl ?? coverByProductId.get(row.id) ?? null;

    productMetaByBrandId.set(row.brandId, {
      firstProductImageUrl,
      productCount: current.productCount + 1,
    });
  }

  return brandRows.map((row) => {
    const productMeta = productMetaByBrandId.get(row.id);

    return {
      firstProductImageUrl: productMeta?.firstProductImageUrl ?? null,
      id: row.id,
      logoUrl: toMediaUrl(row.logoRelativePath, row.logoThumbnailRelativePath),
      name: row.name,
      productCount: productMeta?.productCount ?? 0,
      slug: row.slug,
    };
  });
}

export async function getMarketplaceProductBySlug(
  slug: string,
  currencyContext: CurrencyContext,
): Promise<MarketplaceProductDetail | null> {
  const rows = await getPublicProductsBaseRows();
  const product = rows.find((row) => row.slug === slug);

  if (!product) {
    return null;
  }

  const [variantRows, mediaRows] = await Promise.all([
    db
      .select({
        compareAtPrice: productVariants.compareAtPrice,
        continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
        exchangeAcceptedReturnBrands:
          productVariants.exchangeAcceptedReturnBrands,
        exchangeConfirmationText: productVariants.exchangeConfirmationText,
        exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
        id: productVariants.id,
        mediaId: productVariants.mediaId,
        notes: productVariants.notes,
        optionValues: productVariants.optionValues,
        price: productVariants.price,
        requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
        sku: productVariants.sku,
        status: productVariants.status,
        stockOnHand: productVariants.stockOnHand,
        title: productVariants.title,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(asc(productVariants.title)),
    db
      .select({
        relativePath: media.relativePath,
        sortOrder: productMedia.sortOrder,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.sortOrder)),
  ]);
  const imageUrls = mediaRows
    .map((row) => toMediaUrl(row.relativePath, row.thumbnailRelativePath))
    .filter((url): url is string => Boolean(url));
  const activeVariantRows = variantRows.filter(
    (variant) => variant.status === "active",
  );
  const activeVariantIds = activeVariantRows.map((variant) => variant.id);
  const variantSalesRows =
    activeVariantIds.length > 0
      ? await db
          .select({
            soldQuantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
            variantId: orderItems.variantId,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(
            and(
              inArray(orderItems.variantId, activeVariantIds),
              inArray(orders.status, ["paid", "fulfilled"]),
            ),
          )
          .groupBy(orderItems.variantId)
      : [];
  const soldQuantityByVariantId = new Map(
    variantSalesRows.map((row) => [
      row.variantId,
      Number(row.soldQuantity) || 0,
    ]),
  );
  const variantMediaIds = Array.from(
    new Set(
      activeVariantRows
        .map((variant) => variant.mediaId)
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    ),
  );
  const variantMediaRows =
    variantMediaIds.length > 0
      ? await db
          .select({
            id: media.id,
            relativePath: media.relativePath,
            thumbnailRelativePath: media.thumbnailRelativePath,
          })
          .from(media)
          .where(inArray(media.id, variantMediaIds))
      : [];
  const variantMediaById = new Map(
    variantMediaRows.map((row) => [
      row.id,
      toMediaUrl(row.relativePath, row.thumbnailRelativePath),
    ]),
  );
  const variants = activeVariantRows.map((variant): MarketplaceVariant => ({
    compareAtPrice: variant.compareAtPrice,
    exchangeAcceptedReturnBrands: variant.exchangeAcceptedReturnBrands ?? [],
    exchangeConfirmationText: variant.exchangeConfirmationText,
    exchangeEmptyCylinderSize: variant.exchangeEmptyCylinderSize,
    id: variant.id,
    imageUrl: variant.mediaId
      ? (variantMediaById.get(variant.mediaId) ?? imageUrls[0] ?? null)
      : (imageUrls[0] ?? null),
    inStock: getVariantInStock(variant),
    notes: variant.notes,
    optionValues: variant.optionValues,
    price: variant.price,
    requiresExchangeEmpty: variant.requiresExchangeEmpty,
    sku: variant.sku,
    soldQuantity: soldQuantityByVariantId.get(variant.id) ?? 0,
    stockOnHand: variant.stockOnHand,
    title: variant.title,
  }));

  return {
    barcode: product.barcode,
    brandId: product.brandId,
    brandName: product.brandName,
    brandSlug: product.brandSlug,
    category: toCategory(product),
    coverImageUrl: imageUrls[0] ?? null,
    description: product.description,
    fulfillmentMode: product.fulfillmentMode,
    fullDescription: product.fullDescription,
    hasExchangeOption: variants.some((variant) => variant.requiresExchangeEmpty),
    id: product.id,
    imageUrls,
    inStock: variants.some((variant) => variant.inStock),
    optionSchema: product.optionSchema ?? [],
    priceLabel: getPriceLabel(variants, currencyContext),
    ...getProductCardSaleData(variants, currencyContext),
    quickAddVariantId: getQuickAddVariantId(activeVariantRows),
    shortDescription: product.shortDescription,
    slug: product.slug,
    title: product.title,
    updatedAt: product.updatedAt,
    variantCount: variants.length,
    variants,
  };
}
