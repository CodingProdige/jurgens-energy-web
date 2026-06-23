import { and, asc, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  categories,
  media,
  productMedia,
  productVariants,
  products,
  sellers,
} from "@/src/db/schema";
import {
  formatRangeFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
import { getMediaPublicUrl } from "@/src/modules/media/paths";

const publicProductStatuses = ["live", "active"] as const;

export type MarketplaceCategorySummary = {
  id: string;
  name: string;
  path: string;
  slug: string;
};

export type MarketplaceProductCard = {
  brandName: string | null;
  category: MarketplaceCategorySummary | null;
  coverImageUrl: string | null;
  id: string;
  inStock: boolean;
  priceLabel: string;
  sellerName: string;
  sellerSlug: string;
  shortDescription: string | null;
  slug: string;
  title: string;
  variantCount: number;
};

export type MarketplaceVariant = {
  compareAtPrice: string | null;
  id: string;
  inStock: boolean;
  optionValues: string[];
  price: string;
  sku: string;
  stockOnHand: number;
  title: string;
};

export type MarketplaceProductDetail = MarketplaceProductCard & {
  barcode: string | null;
  description: string | null;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  fullDescription: string | null;
  imageUrls: string[];
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

async function getPublicProductsBaseRows() {
  return db
    .select({
      barcode: products.barcode,
      brandName: brands.name,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryPath: categories.path,
      categorySlug: categories.slug,
      description: products.description,
      fulfillmentMode: products.fulfillmentMode,
      fullDescription: products.fullDescription,
      id: products.id,
      sellerName: sellers.displayName,
      sellerSlug: sellers.slug,
      shortDescription: products.shortDescription,
      slug: products.slug,
      title: products.title,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(sellers, eq(sellers.id, products.sellerId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(
      andPublicProductStatus(),
    )
    .orderBy(desc(products.updatedAt), asc(products.title));
}

function andPublicProductStatus() {
  return and(
    eq(sellers.status, "active"),
    or(
      eq(products.status, publicProductStatuses[0]),
      eq(products.status, publicProductStatuses[1]),
    ),
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
    name: row.categoryName,
    path: row.categoryPath,
    slug: row.categorySlug,
  };
}

export async function getMarketplaceCatalog({
  categorySlug,
  currencyContext,
  limit = 48,
  query,
}: {
  categorySlug?: string;
  currencyContext: CurrencyContext;
  limit?: number;
  query?: string;
}) {
  const rows = await getPublicProductsBaseRows();
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const filteredRows = rows
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
        row.sellerName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    })
    .slice(0, limit);
  const productIds = filteredRows.map((row) => row.id);

  if (productIds.length === 0) {
    return {
      categories: await getMarketplaceCategories(),
      products: [],
    };
  }

  const [variantRows, coverRows] = await Promise.all([
    db
      .select({
        continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
        price: productVariants.price,
        productId: productVariants.productId,
        status: productVariants.status,
        stockOnHand: productVariants.stockOnHand,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds))
      .orderBy(asc(productVariants.title)),
    db
      .select({
        productId: productMedia.productId,
        relativePath: media.relativePath,
        sortOrder: productMedia.sortOrder,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(inArray(productMedia.productId, productIds))
      .orderBy(asc(productMedia.sortOrder)),
  ]);

  const variantsByProductId = new Map<
    string,
    Array<{
      continueSellingOutOfStock: boolean;
      price: string;
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

  const coverByProductId = new Map<string, string | null>();

  for (const row of coverRows) {
    if (!coverByProductId.has(row.productId)) {
      coverByProductId.set(
        row.productId,
        toMediaUrl(row.relativePath, row.thumbnailRelativePath),
      );
    }
  }

  const productsList = filteredRows.map((row): MarketplaceProductCard => {
    const variants = variantsByProductId.get(row.id) ?? [];

    return {
      brandName: row.brandName,
      category: toCategory(row),
      coverImageUrl: coverByProductId.get(row.id) ?? null,
      id: row.id,
      inStock: variants.some(getVariantInStock),
      priceLabel: getPriceLabel(variants, currencyContext),
      sellerName: row.sellerName,
      sellerSlug: row.sellerSlug,
      shortDescription: row.shortDescription,
      slug: row.slug,
      title: row.title,
      variantCount: variants.length,
    };
  });

  return {
    categories: await getMarketplaceCategories(),
    products: productsList,
  };
}

export async function getMarketplaceCategories(): Promise<
  MarketplaceCategorySummary[]
> {
  const rows = await getPublicProductsBaseRows();
  const categoriesById = new Map<string, MarketplaceCategorySummary>();

  for (const row of rows) {
    const category = toCategory(row);

    if (category) {
      categoriesById.set(category.id, category);
    }
  }

  return [...categoriesById.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
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
        id: productVariants.id,
        optionValues: productVariants.optionValues,
        price: productVariants.price,
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

  const variants = variantRows
    .filter((variant) => variant.status === "active")
    .map((variant): MarketplaceVariant => ({
      compareAtPrice: variant.compareAtPrice,
      id: variant.id,
      inStock: getVariantInStock(variant),
      optionValues: variant.optionValues,
      price: variant.price,
      sku: variant.sku,
      stockOnHand: variant.stockOnHand,
      title: variant.title,
    }));
  const imageUrls = mediaRows
    .map((row) => toMediaUrl(row.relativePath, row.thumbnailRelativePath))
    .filter((url): url is string => Boolean(url));

  return {
    barcode: product.barcode,
    brandName: product.brandName,
    category: toCategory(product),
    coverImageUrl: imageUrls[0] ?? null,
    description: product.description,
    fulfillmentMode: product.fulfillmentMode,
    fullDescription: product.fullDescription,
    id: product.id,
    imageUrls,
    inStock: variants.some((variant) => variant.inStock),
    priceLabel: getPriceLabel(variants, currencyContext),
    sellerName: product.sellerName,
    sellerSlug: product.sellerSlug,
    shortDescription: product.shortDescription,
    slug: product.slug,
    title: product.title,
    updatedAt: product.updatedAt,
    variantCount: variants.length,
    variants,
  };
}
