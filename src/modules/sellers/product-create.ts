import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brandRequests,
  brands,
  categories,
  productMedia,
  productReviewEvents,
  products,
  productVariants,
  sellerParcelPresets,
} from "@/src/db/schema";
import { getScopedMediaLibrary } from "@/src/modules/media/admin";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerProductCategory = {
  commissionRateBps: number | null;
  depth: number;
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  slug: string;
};

export type SellerProductBrand = {
  id: string;
  name: string;
};

export type SellerProductBrandRequest = {
  id: string;
  name: string;
  status: "pending";
};

export type SellerParcelPreset = {
  heightMm: number;
  id: string;
  isDefault: boolean;
  lengthMm: number;
  name: string;
  notes: string | null;
  weightGrams: number;
  widthMm: number;
};

export type SellerCreateProductData = {
  brandRequests: SellerProductBrandRequest[];
  brands: SellerProductBrand[];
  categories: SellerProductCategory[];
  mediaLibrary: Awaited<ReturnType<typeof getScopedMediaLibrary>>;
  parcelPresets: SellerParcelPreset[];
  seller: {
    displayName: string;
    id: string;
    isPiessangFulfillmentEnabled: boolean;
  } | null;
};

export type SellerEditableProductData = {
  barcode: string;
  brandName: string;
  categoryId: string | null;
  compareAtPrice: string;
  continueSellingOutOfStock: boolean;
  description: string;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  hasVariants: boolean;
  heightMm: string;
  id: string;
  lengthMm: string;
  longDescription: string;
  mediaIds: string[];
  optionSchema: Array<{
    name: string;
    values: string[];
  }>;
  parcelPresetId: string | null;
  price: string;
  productName: string;
  reviewNote: string | null;
  sku: string;
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
  stock: string;
  variants: Array<{
    barcode: string;
    compareAtPrice: string;
    continueSellingOutOfStock: boolean;
    heightMm: string;
    id: string;
    imageId: string | null;
    isFragile: boolean;
    lengthMm: string;
    lowStockAlert: string;
    notes: string;
    optionValues: string[];
    parcelPresetId: string | null;
    price: string;
    shipsAlone: boolean;
    sku: string;
    status: "active" | "draft" | "sold_out" | "unavailable";
    stock: string;
    weightGrams: string;
    widthMm: string;
  }>;
  weightGrams: string;
  widthMm: string;
};

export async function getSellerCreateProductData(
  userId: string,
): Promise<SellerCreateProductData> {
  const seller = await getPrimarySellerForUser(userId);
  const [
    categoryRows,
    brandRows,
    brandRequestRows,
    parcelPresetRows,
    mediaLibrary,
  ] = await Promise.all([
    db
      .select({
        commissionRateBps: categories.commissionRateBps,
        depth: categories.depth,
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        path: categories.path,
        slug: categories.slug,
      })
      .from(categories)
      .where(eq(categories.status, "active"))
      .orderBy(asc(categories.path)),
    db
      .select({
        id: brands.id,
        name: brands.name,
      })
      .from(brands)
      .where(eq(brands.status, "active"))
      .orderBy(asc(brands.name)),
    seller
      ? db
          .select({
            id: brandRequests.id,
            name: brandRequests.brandName,
            status: brandRequests.status,
          })
          .from(brandRequests)
          .where(
            and(
              eq(brandRequests.sellerId, seller.id),
              eq(brandRequests.status, "pending"),
            ),
          )
          .orderBy(asc(brandRequests.brandName))
      : Promise.resolve([]),
    seller
      ? db
          .select({
            heightMm: sellerParcelPresets.heightMm,
            id: sellerParcelPresets.id,
            isDefault: sellerParcelPresets.isDefault,
            lengthMm: sellerParcelPresets.lengthMm,
            name: sellerParcelPresets.name,
            notes: sellerParcelPresets.notes,
            weightGrams: sellerParcelPresets.weightGrams,
            widthMm: sellerParcelPresets.widthMm,
          })
          .from(sellerParcelPresets)
          .where(
            and(
              eq(sellerParcelPresets.sellerId, seller.id),
              eq(sellerParcelPresets.isActive, true),
            ),
          )
          .orderBy(asc(sellerParcelPresets.name))
      : Promise.resolve([]),
    getScopedMediaLibrary({
      ownerUserId: userId,
      surface: "seller",
    }),
  ]);

  return {
    brandRequests: brandRequestRows.map((request) => ({
      id: request.id,
      name: request.name,
      status: "pending",
    })),
    brands: brandRows,
    categories: categoryRows,
    mediaLibrary,
    parcelPresets: parcelPresetRows,
    seller: seller
      ? {
          displayName: seller.displayName,
          id: seller.id,
          isPiessangFulfillmentEnabled: seller.isPiessangFulfillmentEnabled,
        }
      : null,
  };
}

function formatEditableMetric(value: number | string | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

export async function getSellerEditableProductData({
  productId,
  userId,
}: {
  productId: string;
  userId: string;
}): Promise<SellerEditableProductData | null> {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return null;
  }

  const [product] = await db
    .select({
      barcode: products.barcode,
      brandName: brands.name,
      brandRequestName: brandRequests.brandName,
      categoryId: products.categoryId,
      description: products.description,
      fulfillmentMode: products.fulfillmentMode,
      fullDescription: products.fullDescription,
      id: products.id,
      optionSchema: products.optionSchema,
      sellerId: products.sellerId,
      status: products.status,
      title: products.title,
    })
    .from(products)
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(brandRequests, eq(brandRequests.id, products.brandRequestId))
    .where(and(eq(products.id, productId), eq(products.sellerId, seller.id)))
    .limit(1);

  if (!product) {
    return null;
  }

  const [variantRows, mediaRows, [latestChangeRequest]] = await Promise.all([
    db
      .select({
        barcode: productVariants.barcode,
        compareAtPrice: productVariants.compareAtPrice,
        continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
        heightMm: productVariants.heightMm,
        id: productVariants.id,
        imageId: productVariants.mediaId,
        isFragile: productVariants.isFragile,
        lengthMm: productVariants.lengthMm,
        lowStockAlert: productVariants.lowStockAlert,
        notes: productVariants.notes,
        optionValues: productVariants.optionValues,
        parcelPresetId: productVariants.parcelPresetId,
        price: productVariants.price,
        shipsAlone: productVariants.shipsAlone,
        sku: productVariants.sku,
        status: productVariants.status,
        stock: productVariants.stockOnHand,
        weightGrams: productVariants.weightGrams,
        widthMm: productVariants.widthMm,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(asc(productVariants.title)),
    db
      .select({
        mediaId: productMedia.mediaId,
      })
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.sortOrder)),
    db
      .select({
        note: productReviewEvents.note,
      })
      .from(productReviewEvents)
      .where(
        and(
          eq(productReviewEvents.productId, product.id),
          eq(productReviewEvents.action, "changes_requested"),
        ),
      )
      .orderBy(desc(productReviewEvents.createdAt))
      .limit(1),
  ]);

  const firstVariant = variantRows[0] ?? null;
  const optionSchema = product.optionSchema ?? [];
  const hasVariants =
    optionSchema.length > 0 ||
    variantRows.some((variant) => variant.optionValues.length > 0);

  return {
    barcode: product.barcode ?? firstVariant?.barcode ?? "",
    brandName: product.brandName ?? product.brandRequestName ?? "",
    categoryId: product.categoryId,
    compareAtPrice: firstVariant?.compareAtPrice ?? "",
    continueSellingOutOfStock: firstVariant?.continueSellingOutOfStock ?? false,
    description: product.description ?? "",
    fulfillmentMode: product.fulfillmentMode,
    hasVariants,
    heightMm: formatEditableMetric(firstVariant?.heightMm ?? null),
    id: product.id,
    lengthMm: formatEditableMetric(firstVariant?.lengthMm ?? null),
    longDescription: product.fullDescription ?? "",
    mediaIds: mediaRows.map((row) => row.mediaId),
    optionSchema,
    parcelPresetId: firstVariant?.parcelPresetId ?? null,
    price: firstVariant?.price ?? "",
    productName: product.title,
    reviewNote: latestChangeRequest?.note ?? null,
    sku: firstVariant?.sku ?? "",
    status: product.status,
    stock: String(firstVariant?.stock ?? 0),
    variants: variantRows.map((variant) => ({
      barcode: variant.barcode ?? "",
      compareAtPrice: variant.compareAtPrice ?? "",
      continueSellingOutOfStock: variant.continueSellingOutOfStock,
      heightMm: formatEditableMetric(variant.heightMm),
      id: variant.id,
      imageId: variant.imageId,
      isFragile: variant.isFragile,
      lengthMm: formatEditableMetric(variant.lengthMm),
      lowStockAlert: String(variant.lowStockAlert),
      notes: variant.notes ?? "",
      optionValues: variant.optionValues,
      parcelPresetId: variant.parcelPresetId,
      price: variant.price,
      shipsAlone: variant.shipsAlone,
      sku: variant.sku,
      status: ["active", "draft", "sold_out", "unavailable"].includes(
        variant.status,
      )
        ? (variant.status as "active" | "draft" | "sold_out" | "unavailable")
        : "active",
      stock: String(variant.stock),
      weightGrams: formatEditableMetric(variant.weightGrams),
      widthMm: formatEditableMetric(variant.widthMm),
    })),
    weightGrams: formatEditableMetric(firstVariant?.weightGrams ?? null),
    widthMm: formatEditableMetric(firstVariant?.widthMm ?? null),
  };
}
