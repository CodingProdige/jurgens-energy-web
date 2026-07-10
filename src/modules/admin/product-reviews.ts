import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brandRequests,
  brands,
  categories,
  media,
  productMedia,
  productReviewEvents,
  productVariants,
  products,
} from "@/src/db/schema";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getMissingParcelFields } from "@/src/modules/shipping";

export type AdminProductReviewStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "live"
  | "paused"
  | "admin_suspended"
  | "active"
  | "archived";

export type AdminProductReviewVariant = {
  barcode: string | null;
  compareAtPrice: string | null;
  continueSellingOutOfStock: boolean;
  heightMm: number | null;
  id: string;
  lengthMm: number | null;
  lowStockAlert: number;
  missingShippingFields: string[];
  price: string;
  sku: string;
  status: string;
  stockOnHand: number;
  title: string;
  weightGrams: number | null;
  widthMm: number | null;
};

export type AdminProductReviewRow = {
  barcode: string | null;
  brandName: string | null;
  brandRequestStatus: string | null;
  categoryPath: string | null;
  coverMediaUrl: string | null;
  createdAt: Date;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  id: string;
  mediaCount: number;
  missingParcelVariantCount: number;
  needsBrandReview: boolean;
  optionCount: number;
  sellerName: string;
  sellerSlug: string;
  shortDescription: string | null;
  status: AdminProductReviewStatus;
  submittedAt: Date | null;
  title: string;
  updatedAt: Date;
  variants: AdminProductReviewVariant[];
};

export type AdminProductReviewsData = {
  metrics: {
    approved: number;
    changesRequested: number;
    inHouseFulfilled: number;
    live: number;
    missingParcelData: number;
    pending: number;
    warehouseFulfilled: number;
    totalSubmitted: number;
  };
  reviews: AdminProductReviewRow[];
};

export type AdminProductsData = {
  metrics: {
    active: number;
    adminSuspended: number;
    approved: number;
    archived: number;
    changesRequested: number;
    draft: number;
    inHouseFulfilled: number;
    live: number;
    missingParcelData: number;
    pending: number;
    products: number;
    warehouseFulfilled: number;
    variants: number;
  };
  products: AdminProductReviewRow[];
};

function getMetricCount(
  rows: Array<{ status: AdminProductReviewStatus; fulfillmentMode: string }>,
  predicate: (row: { status: AdminProductReviewStatus; fulfillmentMode: string }) => boolean,
) {
  return rows.filter(predicate).length;
}

function toMediaUrl(relativePath: string | null, thumbnailRelativePath: string | null) {
  const path = thumbnailRelativePath ?? relativePath;

  return path ? getMediaPublicUrl(path) : null;
}

export async function getAdminProductReviews(): Promise<AdminProductReviewsData> {
  const productRows = await db
    .select({
      barcode: products.barcode,
      brandName: brands.name,
      brandRequestName: brandRequests.brandName,
      brandRequestStatus: brandRequests.status,
      categoryPath: categories.path,
      createdAt: products.createdAt,
      fulfillmentMode: products.fulfillmentMode,
      id: products.id,
      optionSchema: products.optionSchema,
      shortDescription: products.shortDescription,
      status: products.status,
      title: products.title,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(brandRequests, eq(brandRequests.id, products.brandRequestId))
    .orderBy(desc(products.updatedAt), asc(products.title));

  const productIds = productRows.map((product) => product.id);

  if (productIds.length === 0) {
    return {
      metrics: {
        approved: 0,
        changesRequested: 0,
        inHouseFulfilled: 0,
        live: 0,
        missingParcelData: 0,
        pending: 0,
        warehouseFulfilled: 0,
        totalSubmitted: 0,
      },
      reviews: [],
    };
  }

  const [variantRows, mediaCountRows, coverRows, reviewEventRows] =
    await Promise.all([
      db
        .select({
          barcode: productVariants.barcode,
          compareAtPrice: productVariants.compareAtPrice,
          continueSellingOutOfStock:
            productVariants.continueSellingOutOfStock,
          heightMm: productVariants.heightMm,
          id: productVariants.id,
          lengthMm: productVariants.lengthMm,
          lowStockAlert: productVariants.lowStockAlert,
          price: productVariants.price,
          productId: productVariants.productId,
          sku: productVariants.sku,
          status: productVariants.status,
          stockOnHand: productVariants.stockOnHand,
          title: productVariants.title,
          weightGrams: productVariants.weightGrams,
          widthMm: productVariants.widthMm,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
        .orderBy(asc(productVariants.title)),
      db
        .select({
          productId: productMedia.productId,
          value: count(),
        })
        .from(productMedia)
        .where(inArray(productMedia.productId, productIds))
        .groupBy(productMedia.productId),
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
      db
        .select({
          action: productReviewEvents.action,
          createdAt: productReviewEvents.createdAt,
          note: productReviewEvents.note,
          productId: productReviewEvents.productId,
          toStatus: productReviewEvents.toStatus,
        })
        .from(productReviewEvents)
        .where(inArray(productReviewEvents.productId, productIds))
        .orderBy(desc(productReviewEvents.createdAt)),
    ]);

  const variantsByProductId = new Map<string, AdminProductReviewVariant[]>();

  for (const row of variantRows) {
    const missingShippingFields = getMissingParcelFields({
      heightMm: row.heightMm,
      lengthMm: row.lengthMm,
      weightGrams: row.weightGrams,
      widthMm: row.widthMm,
    });

    const variants = variantsByProductId.get(row.productId) ?? [];
    variants.push({
      barcode: row.barcode,
      compareAtPrice: row.compareAtPrice,
      continueSellingOutOfStock: row.continueSellingOutOfStock,
      heightMm: row.heightMm,
      id: row.id,
      lengthMm: row.lengthMm,
      lowStockAlert: row.lowStockAlert,
      missingShippingFields,
      price: row.price,
      sku: row.sku,
      status: row.status,
      stockOnHand: row.stockOnHand,
      title: row.title,
      weightGrams: row.weightGrams,
      widthMm: row.widthMm,
    });
    variantsByProductId.set(row.productId, variants);
  }

  const mediaCounts = new Map(
    mediaCountRows.map((row) => [row.productId, row.value]),
  );
  const coverMediaByProductId = new Map<string, string | null>();

  for (const row of coverRows) {
    if (!coverMediaByProductId.has(row.productId)) {
      coverMediaByProductId.set(
        row.productId,
        toMediaUrl(row.relativePath, row.thumbnailRelativePath),
      );
    }
  }

  const submittedAtByProductId = new Map<string, Date>();

  for (const event of reviewEventRows) {
    if (
      event.action === "submitted_for_review" &&
      !submittedAtByProductId.has(event.productId)
    ) {
      submittedAtByProductId.set(event.productId, event.createdAt);
    }
  }

  const reviews = productRows.map((product) => {
    const variants = variantsByProductId.get(product.id) ?? [];

    return {
      barcode: product.barcode,
      brandName: product.brandName ?? product.brandRequestName,
      brandRequestStatus: product.brandRequestStatus,
      categoryPath: product.categoryPath,
      coverMediaUrl: coverMediaByProductId.get(product.id) ?? null,
      createdAt: product.createdAt,
      fulfillmentMode: product.fulfillmentMode,
      id: product.id,
      mediaCount: mediaCounts.get(product.id) ?? 0,
      missingParcelVariantCount: variants.filter(
        (variant) => variant.missingShippingFields.length > 0,
      ).length,
      needsBrandReview: product.brandRequestStatus === "pending",
      optionCount: product.optionSchema?.length ?? 0,
      sellerName: "Jurgens Energy",
      sellerSlug: "single-store",
      shortDescription: product.shortDescription,
      status: product.status,
      submittedAt: submittedAtByProductId.get(product.id) ?? null,
      title: product.title,
      updatedAt: product.updatedAt,
      variants,
    } satisfies AdminProductReviewRow;
  });

  return {
    metrics: {
      approved: getMetricCount(
        productRows,
        (product) => product.status === "approved",
      ),
      changesRequested: getMetricCount(
        productRows,
        (product) => product.status === "changes_requested",
      ),
      inHouseFulfilled: getMetricCount(
        productRows,
        (product) => product.fulfillmentMode === "seller_fulfilled",
      ),
      live: getMetricCount(
        productRows,
        (product) => product.status === "live" || product.status === "active",
      ),
      missingParcelData: reviews.reduce(
        (total, review) => total + review.missingParcelVariantCount,
        0,
      ),
      pending: getMetricCount(
        productRows,
        (product) => product.status === "pending_review",
      ),
      warehouseFulfilled: getMetricCount(
        productRows,
        (product) => product.fulfillmentMode === "piessang_fulfilled",
      ),
      totalSubmitted: productRows.filter((product) => product.status !== "draft")
        .length,
    },
    reviews,
  };
}

export async function getAdminProducts(): Promise<AdminProductsData> {
  const data = await getAdminProductReviews();
  const products = data.reviews;

  return {
    metrics: {
      active: products.filter((product) => product.status === "active").length,
      adminSuspended: products.filter(
        (product) => product.status === "admin_suspended",
      ).length,
      approved: products.filter((product) => product.status === "approved").length,
      archived: products.filter((product) => product.status === "archived")
        .length,
      changesRequested: products.filter(
        (product) => product.status === "changes_requested",
      ).length,
      draft: products.filter((product) => product.status === "draft").length,
      inHouseFulfilled: products.filter(
        (product) => product.fulfillmentMode === "seller_fulfilled",
      ).length,
      live: products.filter(
        (product) => product.status === "live" || product.status === "active",
      ).length,
      missingParcelData: products.reduce(
        (total, product) => total + product.missingParcelVariantCount,
        0,
      ),
      pending: products.filter((product) => product.status === "pending_review")
        .length,
      products: products.length,
      warehouseFulfilled: products.filter(
        (product) => product.fulfillmentMode === "piessang_fulfilled",
      ).length,
      variants: products.reduce(
        (total, product) => total + product.variants.length,
        0,
      ),
    },
    products,
  };
}
