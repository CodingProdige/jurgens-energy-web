"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import {
  categories,
  orderItems,
  productMedia,
  productReviewEvents,
  productVariants,
  products,
} from "@/src/db/schema";
import {
  fulfillmentModeSchema,
  shippingParcelSchema,
} from "@/src/modules/shipping";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";
import {
  importProductLinkMedia,
  saveProductDraft,
} from "@/app/(seller)/seller/(dashboard)/products/new/actions";
import { notifyAdminsProductSubmitted } from "@/src/modules/notifications/events";

export type SellerProductMutationState = {
  error?: string;
  success?: string;
};

const updateProductShippingSchema = z.object({
  fulfillmentMode: fulfillmentModeSchema,
  productId: z.string().uuid(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid(),
        parcel: shippingParcelSchema,
      }),
    )
    .min(1, "At least one variant is required."),
});

const csvImportRowSchema = z.object({
  barcode: z.string().trim().max(120).optional(),
  brandName: z.string().trim().max(120).optional(),
  categoryPath: z.string().trim().max(300).optional(),
  compareAtPrice: z.string().trim().max(40).optional(),
  continueSellingOutOfStock: z.boolean().default(false),
  decision: z.enum(["import", "replace_draft", "skip"]).default("import"),
  fulfillmentMode: fulfillmentModeSchema.default("seller_fulfilled"),
  fullDescription: z.string().trim().max(12000).optional(),
  heightMm: z.string().trim().max(40).optional(),
  id: z.string().trim().min(1).max(80),
  lengthMm: z.string().trim().max(40).optional(),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  optionValues: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .default([]),
  price: z.string().trim().max(40).optional(),
  productName: z.string().trim().min(1).max(240),
  rowNumber: z.number().int().positive(),
  shortDescription: z.string().trim().max(400).optional(),
  sku: z.string().trim().min(1).max(120),
  stock: z.string().trim().max(20).optional(),
  weightGrams: z.string().trim().max(40).optional(),
  widthMm: z.string().trim().max(40).optional(),
});

const csvImportRowsSchema = z.array(csvImportRowSchema).min(1).max(500);
const linkImportDraftSchema = z.object({
  barcode: z.string().trim().max(120).optional(),
  brandName: z.string().trim().max(120).optional(),
  compareAtPrice: z.string().trim().max(40).optional(),
  description: z.string().trim().max(400).optional(),
  images: z
    .array(
      z.object({
        alt: z.string().trim().max(240).optional(),
        url: z.string().url(),
      }),
    )
    .max(10)
    .default([]),
  longDescription: z.string().max(12000).optional(),
  price: z.string().trim().max(40).optional(),
  productName: z.string().trim().min(1).max(240),
  sku: z.string().trim().max(120).optional(),
  sourceUrl: z.string().url().optional(),
});
const productLifecycleSchema = z.object({
  productId: z.string().uuid(),
});
const operationalVariantSchema = z.object({
  compareAtPrice: z.string().trim().max(40).optional(),
  continueSellingOutOfStock: z.boolean().default(false),
  heightMm: z.string().trim().max(40).optional(),
  id: z.string().uuid(),
  isFragile: z.boolean().default(false),
  lengthMm: z.string().trim().max(40).optional(),
  lowStockAlert: z.string().trim().max(20).optional(),
  price: z.string().trim().max(40).optional(),
  shipsAlone: z.boolean().default(false),
  status: z.enum(["active", "draft", "sold_out", "unavailable"]).default("active"),
  stock: z.string().trim().max(20).optional(),
  weightGrams: z.string().trim().max(40).optional(),
  widthMm: z.string().trim().max(40).optional(),
});
const operationalUpdateSchema = z.object({
  productId: z.string().uuid(),
  variants: z.array(operationalVariantSchema).min(1),
});
type SellerProductStatus =
  | "active"
  | "admin_suspended"
  | "approved"
  | "archived"
  | "changes_requested"
  | "draft"
  | "live"
  | "paused"
  | "pending_review";

function normalizeLookup(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildProductKey(row: z.infer<typeof csvImportRowSchema>) {
  return [
    normalizeLookup(row.productName),
    normalizeLookup(row.brandName ?? ""),
    normalizeLookup(row.categoryPath ?? ""),
  ].join("|");
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function skuFromProductName(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return base ? `IMP-${base}` : `IMP-${Date.now()}`;
}

async function getUniqueSku(candidate: string) {
  const base = candidate
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const sku = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const [existing] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.sku, sku))
      .limit(1);

    if (!existing) {
      return sku;
    }
  }

  return `${base}-${Date.now()}`.slice(0, 120);
}

async function getCategoryIdFromPath(categoryPath?: string) {
  const rawPath = categoryPath?.trim() ?? "";
  const normalizedPath = normalizeLookup(rawPath);

  if (!normalizedPath) {
    return null;
  }

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
    })
    .from(categories);

  const parts = rawPath.split(/\s*>\s*/).map(normalizeLookup).filter(Boolean);
  const lastPart = parts.at(-1) ?? normalizedPath;

  return (
    categoryRows.find((category) => normalizeLookup(category.name) === lastPart)?.id ??
    categoryRows.find((category) =>
      normalizeLookup(category.name).includes(lastPart),
    )?.id ??
    null
  );
}

async function getOwnedSellerProduct({
  productId,
  userId,
}: {
  productId: string;
  userId: string;
}) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return {
      error: "Seller access could not be confirmed.",
      product: null,
      seller: null,
    };
  }

  const [product] = await db
    .select({
      id: products.id,
      fulfillmentMode: products.fulfillmentMode,
      sellerId: products.sellerId,
      status: products.status,
      title: products.title,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.sellerId, seller.id)))
    .limit(1);

  return {
    error: product ? null : "This product does not belong to your seller account.",
    product: product ?? null,
    seller,
  };
}

function productActionResult(ok: boolean, message: string) {
  return { ok, message };
}

function parseOptionalMoneyInput(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null;
}

function parseRequiredMoneyInput(value?: string) {
  const parsed = parseOptionalMoneyInput(value);

  return parsed && Number(parsed) > 0 ? parsed : null;
}

function parseOptionalMetricInput(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStockInput(value?: string) {
  const parsed = Number(value?.trim() || "0");

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

async function getCsvDuplicateContext(
  sellerId: string,
  rows: Array<z.infer<typeof csvImportRowSchema>>,
) {
  const skus = [...new Set(rows.map((row) => row.sku).filter(Boolean))];
  const existingSkuRows =
    skus.length > 0
      ? await db
          .select({
            productId: productVariants.productId,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .where(inArray(productVariants.sku, skus))
      : [];
  const existingProducts = await db
    .select({
      id: products.id,
      status: products.status,
      title: products.title,
    })
    .from(products)
    .where(eq(products.sellerId, sellerId));
  const existingProductsByTitle = new Map(
    existingProducts.map((product) => [normalizeLookup(product.title), product]),
  );

  return {
    existingProductsByTitle,
    existingSkuRows,
  };
}

export async function updateSellerProductShipping(
  _state: SellerProductMutationState,
  formData: FormData,
): Promise<SellerProductMutationState> {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { error: "Seller access could not be confirmed." };
  }

  const variantIds = formData.getAll("variantId").map(String);
  const parsed = updateProductShippingSchema.safeParse({
    fulfillmentMode: formData.get("fulfillmentMode"),
    productId: formData.get("productId"),
    variants: variantIds.map((variantId) => ({
      id: variantId,
      parcel: {
        heightMm: formData.get(`heightMm:${variantId}`),
        isFragile: formData.get(`isFragile:${variantId}`) === "on",
        lengthMm: formData.get(`lengthMm:${variantId}`),
        shipsAlone: formData.get(`shipsAlone:${variantId}`) === "on",
        weightGrams: formData.get(`weightGrams:${variantId}`),
        widthMm: formData.get(`widthMm:${variantId}`),
      },
    })),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the product shipping details.",
    };
  }

  if (
    parsed.data.fulfillmentMode === "piessang_fulfilled" &&
    !seller.isPiessangFulfillmentEnabled
  ) {
    return {
      error:
        "Fulfilled by Piessang is invitation-only and is not enabled for this seller account yet.",
    };
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.id, parsed.data.productId),
        eq(products.sellerId, seller.id),
      ),
    )
    .limit(1);

  if (!product) {
    return { error: "This product does not belong to your seller account." };
  }

  const existingVariants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, parsed.data.productId),
        inArray(
          productVariants.id,
          parsed.data.variants.map((variant) => variant.id),
        ),
      ),
    );

  if (existingVariants.length !== parsed.data.variants.length) {
    return { error: "One or more variants could not be confirmed." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        fulfillmentMode: parsed.data.fulfillmentMode,
        updatedAt: new Date(),
      })
      .where(eq(products.id, parsed.data.productId));

    for (const variant of parsed.data.variants) {
      await tx
        .update(productVariants)
        .set({
          heightMm: variant.parcel.heightMm,
          isFragile: variant.parcel.isFragile,
          lengthMm: variant.parcel.lengthMm,
          shipsAlone: variant.parcel.shipsAlone,
          weightGrams: variant.parcel.weightGrams,
          widthMm: variant.parcel.widthMm,
        })
        .where(eq(productVariants.id, variant.id));
    }
  });

  revalidatePath("/seller/products");

  return { success: "Product shipping details saved." };
}

export async function cancelSellerProductReview(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = productLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(false, "This product could not be confirmed.");
  }

  const { error, product } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (product.status !== "pending_review") {
    return productActionResult(false, "Only products pending review can be cancelled.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "draft", updatedAt: new Date() })
      .where(
        and(eq(products.id, product.id), eq(products.status, "pending_review")),
      );
    await tx.insert(productReviewEvents).values({
      action: "review_cancelled",
      actorUserId: session.user.id,
      fromStatus: "pending_review",
      note: "Seller cancelled review and returned product to draft.",
      productId: product.id,
      toStatus: "draft",
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  return productActionResult(true, "Review cancelled. Product returned to draft.");
}

export async function submitSavedSellerProductForReview(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = productLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(false, "This product could not be confirmed.");
  }

  const { error, product, seller } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product || !seller) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (!["draft", "changes_requested"].includes(product.status)) {
    return productActionResult(
      false,
      "Only draft products or products with requested changes can be submitted.",
    );
  }

  const [[mediaTotal], variants] = await Promise.all([
    db
      .select({ value: count() })
      .from(productMedia)
      .where(eq(productMedia.productId, product.id)),
    db
      .select({
        barcode: productVariants.barcode,
        compareAtPrice: productVariants.compareAtPrice,
        heightMm: productVariants.heightMm,
        lengthMm: productVariants.lengthMm,
        price: productVariants.price,
        sku: productVariants.sku,
        weightGrams: productVariants.weightGrams,
        widthMm: productVariants.widthMm,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, product.id)),
  ]);

  if (variants.length === 0) {
    return productActionResult(false, "Add at least one variant before submitting.");
  }

  if ((mediaTotal?.value ?? 0) === 0) {
    return productActionResult(false, "Add at least one product image before submitting.");
  }

  for (const variant of variants) {
    if (!variant.sku.trim()) {
      return productActionResult(false, "Every variant must have a SKU before submitting.");
    }

    if (!Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0) {
      return productActionResult(false, "Every variant needs a VAT-inclusive price.");
    }

    if (
      variant.compareAtPrice &&
      Number(variant.compareAtPrice) <= Number(variant.price)
    ) {
      return productActionResult(
        false,
        "Compare-at prices must be higher than selling prices.",
      );
    }

    if (
      !variant.weightGrams ||
      !variant.lengthMm ||
      !variant.widthMm ||
      !variant.heightMm
    ) {
      return productActionResult(false, "Complete parcel data before submitting.");
    }

    if (product.fulfillmentMode === "piessang_fulfilled" && !variant.barcode) {
      return productActionResult(
        false,
        "Every FBP variant needs a barcode before submitting.",
      );
    }
  }

  const fromStatus = product.status;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "pending_review", updatedAt: new Date() })
      .where(
        and(
          eq(products.id, product.id),
          inArray(products.status, ["draft", "changes_requested"]),
        ),
      );
    await tx.insert(productReviewEvents).values({
      action: "submitted_for_review",
      actorUserId: session.user.id,
      fromStatus,
      note: "Seller submitted saved product for admin review.",
      productId: product.id,
      toStatus: "pending_review",
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  await notifyAdminsProductSubmitted({
    productId: product.id,
    productTitle: product.title,
    sellerName: seller.displayName,
  });

  return productActionResult(true, "Product submitted for review.");
}

export async function updateSellerProductOperationalFields(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = operationalUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(
      false,
      parsed.error.issues[0]?.message ?? "Check the operational product fields.",
    );
  }

  const { error, product } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (!["approved", "active", "live", "paused"].includes(product.status)) {
    return productActionResult(
      false,
      "Only approved, active, live, or paused products support operational edits.",
    );
  }

  const existingVariants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, product.id),
        inArray(
          productVariants.id,
          parsed.data.variants.map((variant) => variant.id),
        ),
      ),
    );

  if (existingVariants.length !== parsed.data.variants.length) {
    return productActionResult(false, "One or more variants could not be confirmed.");
  }

  for (const variant of parsed.data.variants) {
    const price = parseRequiredMoneyInput(variant.price);
    const compareAtPrice = parseOptionalMoneyInput(variant.compareAtPrice);

    if (!price) {
      return productActionResult(false, "Every variant needs a VAT-inclusive price.");
    }

    if (compareAtPrice && Number(compareAtPrice) <= Number(price)) {
      return productActionResult(
        false,
        "Compare-at prices must be higher than selling prices.",
      );
    }

    if (
      !parseOptionalMetricInput(variant.weightGrams) ||
      !parseOptionalMetricInput(variant.lengthMm) ||
      !parseOptionalMetricInput(variant.widthMm) ||
      !parseOptionalMetricInput(variant.heightMm)
    ) {
      return productActionResult(false, "Complete parcel data for every variant.");
    }
  }

  await db.transaction(async (tx) => {
    for (const variant of parsed.data.variants) {
      await tx
        .update(productVariants)
        .set({
          compareAtPrice: parseOptionalMoneyInput(variant.compareAtPrice),
          continueSellingOutOfStock:
            product.fulfillmentMode === "piessang_fulfilled"
              ? false
              : variant.continueSellingOutOfStock,
          heightMm: parseOptionalMetricInput(variant.heightMm),
          isActive: variant.status === "active",
          isFragile: variant.isFragile,
          lengthMm: parseOptionalMetricInput(variant.lengthMm),
          lowStockAlert:
            product.fulfillmentMode === "piessang_fulfilled"
              ? 0
              : parseStockInput(variant.lowStockAlert || "5"),
          price: parseRequiredMoneyInput(variant.price) ?? "0.00",
          shipsAlone: variant.shipsAlone,
          status: variant.status,
          stockOnHand:
            product.fulfillmentMode === "piessang_fulfilled"
              ? 0
              : parseStockInput(variant.stock),
          weightGrams: parseOptionalMetricInput(variant.weightGrams),
          widthMm: parseOptionalMetricInput(variant.widthMm),
        })
        .where(eq(productVariants.id, variant.id));
    }

    await tx
      .update(products)
      .set({ updatedAt: new Date() })
      .where(eq(products.id, product.id));
    await tx.insert(productReviewEvents).values({
      action: "operational_fields_updated",
      actorUserId: session.user.id,
      fromStatus: product.status,
      note: "Seller updated operational product fields.",
      productId: product.id,
      toStatus: product.status,
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  return productActionResult(true, "Operational product fields saved.");
}

export async function pauseSellerProduct(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = productLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(false, "This product could not be confirmed.");
  }

  const { error, product } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (!["active", "live"].includes(product.status)) {
    return productActionResult(false, "Only active products can be paused.");
  }

  const fromStatus = product.status;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(products.id, product.id), inArray(products.status, ["active", "live"])));
    await tx.insert(productReviewEvents).values({
      action: "paused",
      actorUserId: session.user.id,
      fromStatus,
      note: "Seller paused this product.",
      productId: product.id,
      toStatus: "paused",
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  return productActionResult(true, "Product paused.");
}

export async function activateSellerProduct(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = productLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(false, "This product could not be confirmed.");
  }

  const { error, product } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (!["approved", "paused"].includes(product.status)) {
    return productActionResult(false, "Only approved or paused products can be activated.");
  }

  const [variantTotal] = await db
    .select({ value: count() })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));

  if ((variantTotal?.value ?? 0) === 0) {
    return productActionResult(false, "Add at least one variant before activating.");
  }

  const fromStatus = product.status;
  const nextStatus = "live";

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(and(eq(products.id, product.id), inArray(products.status, ["approved", "paused"])));
    await tx.insert(productReviewEvents).values({
      action: "activated",
      actorUserId: session.user.id,
      fromStatus,
      note: "Seller activated this product.",
      productId: product.id,
      toStatus: nextStatus,
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  return productActionResult(true, "Product activated.");
}

export async function deleteOrArchiveSellerProduct(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const parsed = productLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return productActionResult(false, "This product could not be confirmed.");
  }

  const { error, product } = await getOwnedSellerProduct({
    productId: parsed.data.productId,
    userId: session.user.id,
  });

  if (error || !product) {
    return productActionResult(false, error ?? "This product could not be confirmed.");
  }

  if (["admin_suspended", "archived", "pending_review"].includes(product.status)) {
    return productActionResult(
      false,
      "This product cannot be deleted or archived in its current status.",
    );
  }

  const [historyTotal] = await db
    .select({ value: count() })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(productVariants.productId, product.id));
  const hasSalesHistory = (historyTotal?.value ?? 0) > 0;

  if (!hasSalesHistory) {
    await db.delete(products).where(eq(products.id, product.id));

    revalidatePath("/seller/products");

    return productActionResult(true, "Product deleted.");
  }

  const fromStatus = product.status;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(products.id, product.id));
    await tx.insert(productReviewEvents).values({
      action: "archived",
      actorUserId: session.user.id,
      fromStatus,
      note: "Seller archived this product because it has order history.",
      productId: product.id,
      toStatus: "archived",
    });
  });

  revalidatePath("/seller/products");
  revalidatePath(`/seller/products/${product.id}/edit`);

  return productActionResult(true, "Product has sales history, so it was archived.");
}

export async function checkSellerProductCsvImport(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { ok: false, message: "Seller access could not be confirmed." };
  }

  const parsed = csvImportRowsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the CSV rows.",
    };
  }

  const rows = parsed.data;
  const skuCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();

  for (const row of rows) {
    const skuKey = normalizeLookup(row.sku);
    skuCounts.set(skuKey, (skuCounts.get(skuKey) ?? 0) + 1);
    const productKey = buildProductKey(row);
    productCounts.set(productKey, (productCounts.get(productKey) ?? 0) + 1);
  }

  const { existingProductsByTitle, existingSkuRows } =
    await getCsvDuplicateContext(seller.id, rows);

  const checkedRows = rows.map((row) => {
    const issues: string[] = [];
    const duplicateSkuInCsv = (skuCounts.get(normalizeLookup(row.sku)) ?? 0) > 1;
    const duplicateProductInCsv = row.optionValues.length === 0
      ? (productCounts.get(buildProductKey(row)) ?? 0) > 1
      : false;
    const existingSku = existingSkuRows.find(
      (variant) => normalizeLookup(variant.sku) === normalizeLookup(row.sku),
    );
    const existingProduct = existingProductsByTitle.get(
      normalizeLookup(row.productName),
    );

    if (!row.brandName) {
      issues.push("Brand is missing.");
    }
    if (!row.categoryPath) {
      issues.push("Category is missing.");
    }
    if (!row.price) {
      issues.push("VAT-inclusive price is missing.");
    }
    if (!row.weightGrams || !row.lengthMm || !row.widthMm || !row.heightMm) {
      issues.push("Parcel weight and dimensions are incomplete.");
    }
    if (duplicateSkuInCsv) {
      issues.push("SKU is duplicated inside this CSV.");
    }
    if (duplicateProductInCsv) {
      issues.push("Product appears more than once in this CSV.");
    }
    if (existingSku) {
      issues.push("SKU already exists in Piessang.");
    }
    if (existingProduct) {
      issues.push(
        existingProduct.status === "draft"
          ? "A draft with this product name already exists."
          : "A product with this name already exists.",
      );
    }

    return {
      ...row,
      duplicateExistingProductId: existingProduct?.id ?? null,
      duplicateExistingProductStatus: existingProduct?.status ?? null,
      duplicateProductInCsv,
      duplicateSkuInCsv,
      existingSkuProductId: existingSku?.productId ?? null,
      issues,
      ready: issues.length === 0,
    };
  });

  return {
    ok: true,
    rows: checkedRows,
  };
}

export async function importSellerProductCsvDrafts(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { ok: false, message: "Seller access could not be confirmed." };
  }

  const parsed = csvImportRowsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the selected CSV rows.",
    };
  }

  const selectedRows = parsed.data.filter((row) => row.decision !== "skip");

  if (selectedRows.length === 0) {
    return { ok: false, message: "Select at least one row to import." };
  }

  const { existingProductsByTitle, existingSkuRows } =
    await getCsvDuplicateContext(seller.id, selectedRows);
  const groups = new Map<string, Array<z.infer<typeof csvImportRowSchema>>>();

  for (const row of selectedRows) {
    const existingSku = existingSkuRows.find(
      (variant) => normalizeLookup(variant.sku) === normalizeLookup(row.sku),
    );

    if (existingSku) {
      continue;
    }

    const key = buildProductKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let imported = 0;
  let skipped = selectedRows.length - [...groups.values()].flat().length;
  let replaced = 0;
  const failures: string[] = [];

  for (const groupRows of groups.values()) {
    const firstRow = groupRows[0];
    const existingProduct = existingProductsByTitle.get(
      normalizeLookup(firstRow.productName),
    );

    if (
      existingProduct &&
      (existingProduct.status !== "draft" || firstRow.decision !== "replace_draft")
    ) {
      skipped += groupRows.length;
      continue;
    }

    const categoryId = await getCategoryIdFromPath(firstRow.categoryPath);
    const mediaUrls = [...new Set(groupRows.flatMap((row) => row.mediaUrls))].slice(
      0,
      10,
    );
    const importedMedia =
      mediaUrls.length > 0
        ? await importProductLinkMedia({
            images: mediaUrls.map((url) => ({
              alt: firstRow.productName,
              url,
            })),
          })
        : null;
    const mediaIds = importedMedia?.ok
      ? (importedMedia.assets ?? []).map((asset) => asset.id)
      : [];
    const hasVariants =
      groupRows.length > 1 || groupRows.some((row) => row.optionValues.length > 0);
    const optionSchema = hasVariants
      ? Array.from(
          groupRows.reduce<Map<string, Set<string>>>((map, row) => {
            for (const option of row.optionValues) {
              const existing = map.get(option.name) ?? new Set<string>();
              existing.add(option.value);
              map.set(option.name, existing);
            }

            return map;
          }, new Map()),
        ).map(([name, values]) => ({
          name,
          values: Array.from(values),
        }))
      : [];
    const variants = hasVariants
      ? groupRows.map((row) => ({
          barcode: row.barcode,
          compareAtPrice: row.compareAtPrice,
          continueSellingOutOfStock: row.continueSellingOutOfStock,
          heightMm: row.heightMm,
          lengthMm: row.lengthMm,
          lowStockAlert: "5",
          optionValues: row.optionValues.map((option) => option.value),
          price: row.price,
          sku: row.sku,
          stock: row.stock,
          status: "active" as const,
          weightGrams: row.weightGrams,
          widthMm: row.widthMm,
        }))
      : [];

    const result = await saveProductDraft({
      barcode: hasVariants ? undefined : firstRow.barcode,
      brandName: firstRow.brandName,
      categoryId,
      compareAtPrice: firstRow.compareAtPrice,
      continueSellingOutOfStock: firstRow.continueSellingOutOfStock,
      description: firstRow.shortDescription,
      fulfillmentMode: firstRow.fulfillmentMode,
      hasVariants,
      heightMm: firstRow.heightMm,
      lengthMm: firstRow.lengthMm,
      longDescription: firstRow.fullDescription,
      mediaIds,
      optionSchema,
      price: firstRow.price,
      productId:
        existingProduct && firstRow.decision === "replace_draft"
          ? existingProduct.id
          : null,
      productName: firstRow.productName,
      sku: firstRow.sku,
      stock: firstRow.stock,
      variants,
      weightGrams: firstRow.weightGrams,
      widthMm: firstRow.widthMm,
    });

    if (result.ok) {
      imported += 1;
      if (existingProduct && firstRow.decision === "replace_draft") {
        replaced += 1;
      }
    } else {
      failures.push(result.message ?? `Could not import ${firstRow.productName}.`);
    }
  }

  revalidatePath("/seller/products");

  return {
    failures,
    imported,
    ok: imported > 0,
    message:
      imported > 0
        ? `${imported} product draft${imported === 1 ? "" : "s"} imported. ${replaced} replaced, ${skipped} skipped.`
        : failures[0] ?? "No product drafts were imported.",
    replaced,
    skipped,
  };
}

export async function importSellerProductLinkDraft(input: unknown) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { ok: false, message: "Seller access could not be confirmed." };
  }

  const parsed = linkImportDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the imported product details.",
    };
  }

  const product = parsed.data;
  const importedMedia =
    product.images.length > 0
      ? await importProductLinkMedia({ images: product.images })
      : null;
  const mediaIds = importedMedia?.ok
    ? (importedMedia.assets ?? []).map((asset) => asset.id)
    : [];
  const sku = await getUniqueSku(product.sku || skuFromProductName(product.productName));
  const result = await saveProductDraft({
    barcode: product.barcode,
    brandName: product.brandName ? titleCase(product.brandName).slice(0, 120) : undefined,
    categoryId: null,
    compareAtPrice: product.compareAtPrice,
    continueSellingOutOfStock: false,
    description: product.description,
    fulfillmentMode: "seller_fulfilled",
    hasVariants: false,
    longDescription: product.longDescription,
    mediaIds,
    optionSchema: [],
    price: product.price,
    productId: null,
    productName: titleCase(product.productName).slice(0, 240),
    sku,
    stock: "0",
    variants: [],
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath("/seller/products");

  return {
    ...result,
    message: "Imported product saved as a draft.",
  };
}
