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
  formatRangeFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
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

export type MarketplaceProductCard = {
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  category: MarketplaceCategorySummary | null;
  coverImageUrl: string | null;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  hasExchangeOption: boolean;
  id: string;
  inStock: boolean;
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
    quickAddVariantId: getQuickAddVariantId(activeVariantRows),
    shortDescription: product.shortDescription,
    slug: product.slug,
    title: product.title,
    updatedAt: product.updatedAt,
    variantCount: variants.length,
    variants,
  };
}
