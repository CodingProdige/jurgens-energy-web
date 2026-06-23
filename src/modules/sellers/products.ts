import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { media, productMedia, productVariants, products } from "@/src/db/schema";
import { getMediaPublicUrl } from "@/src/modules/media";
import { getMissingParcelFields } from "@/src/modules/shipping";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerProductVariant = {
  heightMm: number | null;
  id: string;
  isActive: boolean;
  isFragile: boolean;
  lengthMm: number | null;
  missingShippingFields: string[];
  price: string;
  shipsAlone: boolean;
  sku: string;
  stockOnHand: number;
  title: string;
  weightGrams: number | null;
  widthMm: number | null;
};

export type SellerProductRow = {
  activeVariantCount: number;
  createdAt: Date;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  id: string;
  primaryImage: {
    altText: string | null;
    url: string;
  } | null;
  readyVariantCount: number;
  shippingReady: boolean;
  slug: string;
  status:
    | "active"
    | "admin_suspended"
    | "approved"
    | "archived"
    | "changes_requested"
    | "draft"
    | "live"
    | "paused"
    | "pending_review";
  title: string;
  totalStock: number;
  updatedAt: Date;
  variants: SellerProductVariant[];
};

export type SellerProductsPageData = {
  metrics: {
    activeProducts: number;
    archivedProducts: number;
    draftProducts: number;
    missingParcelData: number;
    piessangFulfilled: number;
    products: number;
    readyForRates: number;
    sellerFulfilled: number;
    variants: number;
  };
  products: SellerProductRow[];
  seller: {
    displayName: string;
    id: string;
    isPiessangFulfillmentEnabled: boolean;
  } | null;
};

function buildEmptyData(): SellerProductsPageData {
  return {
    metrics: {
      activeProducts: 0,
      archivedProducts: 0,
      draftProducts: 0,
      missingParcelData: 0,
      piessangFulfilled: 0,
      products: 0,
      readyForRates: 0,
      sellerFulfilled: 0,
      variants: 0,
    },
    products: [],
    seller: null,
  };
}

export async function getSellerProductsPageData(
  userId: string,
): Promise<SellerProductsPageData> {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return buildEmptyData();
  }

  const rows = await db
    .select({
      heightMm: productVariants.heightMm,
      isFragile: productVariants.isFragile,
      lengthMm: productVariants.lengthMm,
      productCreatedAt: products.createdAt,
      productFulfillmentMode: products.fulfillmentMode,
      productId: products.id,
      productSlug: products.slug,
      productStatus: products.status,
      productTitle: products.title,
      productUpdatedAt: products.updatedAt,
      shipsAlone: productVariants.shipsAlone,
      variantId: productVariants.id,
      variantIsActive: productVariants.isActive,
      variantPrice: productVariants.price,
      variantSku: productVariants.sku,
      variantStockOnHand: productVariants.stockOnHand,
      variantTitle: productVariants.title,
      weightGrams: productVariants.weightGrams,
      widthMm: productVariants.widthMm,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(eq(products.sellerId, seller.id))
    .orderBy(asc(products.title), asc(productVariants.title));
  const productIds = [...new Set(rows.map((row) => row.productId))];
  const coverRows =
    productIds.length > 0
      ? await db
          .select({
            altText: media.altText,
            productId: productMedia.productId,
            relativePath: media.relativePath,
            sortOrder: productMedia.sortOrder,
            thumbnailRelativePath: media.thumbnailRelativePath,
          })
          .from(productMedia)
          .innerJoin(media, eq(media.id, productMedia.mediaId))
          .where(inArray(productMedia.productId, productIds))
          .orderBy(asc(productMedia.productId), asc(productMedia.sortOrder))
      : [];
  const coverByProductId = new Map<string, {
    altText: string | null;
    url: string;
  }>();

  for (const row of coverRows) {
    if (coverByProductId.has(row.productId)) {
      continue;
    }

    coverByProductId.set(row.productId, {
      altText: row.altText,
      url: getMediaPublicUrl(row.thumbnailRelativePath ?? row.relativePath),
    });
  }

  const productsById = new Map<string, SellerProductRow>();

  for (const row of rows) {
    const product: SellerProductRow =
      productsById.get(row.productId) ??
      {
        activeVariantCount: 0,
        createdAt: row.productCreatedAt,
        fulfillmentMode: row.productFulfillmentMode,
        id: row.productId,
        primaryImage: coverByProductId.get(row.productId) ?? null,
        readyVariantCount: 0,
        shippingReady: false,
        slug: row.productSlug,
        status: row.productStatus,
        title: row.productTitle,
        totalStock: 0,
        updatedAt: row.productUpdatedAt,
        variants: [],
      };

    if (row.variantId) {
      const missingShippingFields = getMissingParcelFields({
        heightMm: row.heightMm,
        lengthMm: row.lengthMm,
        weightGrams: row.weightGrams,
        widthMm: row.widthMm,
      });

      product.variants.push({
        heightMm: row.heightMm,
        id: row.variantId,
        isActive: row.variantIsActive ?? false,
        isFragile: row.isFragile ?? false,
        lengthMm: row.lengthMm,
        missingShippingFields,
        price: row.variantPrice ?? "0",
        shipsAlone: row.shipsAlone ?? false,
        sku: row.variantSku ?? "",
        stockOnHand: row.variantStockOnHand ?? 0,
        title: row.variantTitle ?? "Variant",
        weightGrams: row.weightGrams,
        widthMm: row.widthMm,
      });

      product.totalStock += row.variantStockOnHand ?? 0;
      product.activeVariantCount += row.variantIsActive ? 1 : 0;

      if (missingShippingFields.length === 0) {
        product.readyVariantCount += 1;
      }
    }

    productsById.set(row.productId, product);
  }

  const sellerProducts = Array.from(productsById.values()).map((product) => ({
    ...product,
    shippingReady:
      product.variants.length > 0 &&
      product.readyVariantCount === product.variants.length,
  }));

  const variantCount = sellerProducts.reduce(
    (total, product) => total + product.variants.length,
    0,
  );
  const readyVariantCount = sellerProducts.reduce(
    (total, product) => total + product.readyVariantCount,
    0,
  );

  return {
    metrics: {
      activeProducts: sellerProducts.filter((product) =>
        ["active", "live"].includes(product.status),
      ).length,
      archivedProducts: sellerProducts.filter(
        (product) => product.status === "archived",
      ).length,
      draftProducts: sellerProducts.filter((product) => product.status === "draft")
        .length,
      missingParcelData: Math.max(0, variantCount - readyVariantCount),
      piessangFulfilled: sellerProducts.filter(
        (product) => product.fulfillmentMode === "piessang_fulfilled",
      ).length,
      products: sellerProducts.length,
      readyForRates: sellerProducts.filter((product) => product.shippingReady)
        .length,
      sellerFulfilled: sellerProducts.filter(
        (product) => product.fulfillmentMode === "seller_fulfilled",
      ).length,
      variants: variantCount,
    },
    products: sellerProducts,
    seller: {
      displayName: seller.displayName,
      id: seller.id,
      isPiessangFulfillmentEnabled: seller.isPiessangFulfillmentEnabled,
    },
  };
}
