"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/src/config/env";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import {
  brandRequests,
  brands,
  categories,
  media,
  productMedia,
  productReviewEvents,
  products,
  productVariants,
  sellerParcelPresets,
} from "@/src/db/schema";
import { processAndStoreMediaUpload } from "@/src/modules/media/admin";
import type { AdminMediaAsset } from "@/src/modules/media/admin";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { notifyAdminsProductSubmitted } from "@/src/modules/notifications/events";
import { fulfillmentModeSchema } from "@/src/modules/shipping";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

const productDescriptionGenerationSchema = z.object({
  kind: z.enum(["short", "long"]),
  productName: z.string().trim().min(2).max(500),
});
const importedMediaSchema = z.object({
  images: z
    .array(
      z.object({
        alt: z.string().trim().max(240).optional(),
        url: z.string().url(),
      }),
    )
    .max(10),
});
const parcelPresetInputSchema = z.object({
  heightMm: z.string().trim().max(40),
  isDefault: z.boolean().default(false),
  lengthMm: z.string().trim().max(40),
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(500).optional(),
  weightGrams: z.string().trim().max(40),
  widthMm: z.string().trim().max(40),
});
const variantStatusSchema = z.enum(["active", "draft", "sold_out", "unavailable"]);
const productOptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  values: z.array(z.string().trim().min(1).max(80)).max(100),
});
const productDraftVariantSchema = z.object({
  barcode: z.string().trim().max(120).optional(),
  compareAtPrice: z.string().trim().max(40).optional(),
  continueSellingOutOfStock: z.boolean().default(false),
  heightMm: z.string().trim().max(40).optional(),
  imageId: z.string().uuid().nullable().optional(),
  lengthMm: z.string().trim().max(40).optional(),
  lowStockAlert: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
  optionValues: z.array(z.string().trim().min(1).max(120)).max(20),
  parcelPresetId: z.string().uuid().nullable().optional(),
  price: z.string().trim().max(40).optional(),
  sku: z.string().trim().min(1).max(120),
  status: variantStatusSchema.default("active"),
  stock: z.string().trim().max(20).optional(),
  weightGrams: z.string().trim().max(40).optional(),
  widthMm: z.string().trim().max(40).optional(),
});
const productDraftSchema = z.object({
  barcode: z.string().trim().max(120).optional(),
  brandName: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  compareAtPrice: z.string().trim().max(40).optional(),
  continueSellingOutOfStock: z.boolean().default(false),
  description: z.string().trim().max(400).optional(),
  fulfillmentMode: fulfillmentModeSchema,
  hasVariants: z.boolean().default(false),
  heightMm: z.string().trim().max(40).optional(),
  lengthMm: z.string().trim().max(40).optional(),
  longDescription: z.string().max(12000).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).default([]),
  optionSchema: z.array(productOptionSchema).max(20).default([]),
  parcelPresetId: z.string().uuid().nullable().optional(),
  price: z.string().trim().max(40).optional(),
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(240),
  sku: z.string().trim().min(1).max(120),
  stock: z.string().trim().max(20).optional(),
  variants: z.array(productDraftVariantSchema).max(250).default([]),
  weightGrams: z.string().trim().max(40).optional(),
  widthMm: z.string().trim().max(40).optional(),
});

type ProductDraftInput = z.infer<typeof productDraftSchema>;
type ProductLifecycleStatus =
  | "active"
  | "admin_suspended"
  | "approved"
  | "archived"
  | "changes_requested"
  | "draft"
  | "live"
  | "paused"
  | "pending_review";

export type ImportedProductMediaState = {
  assets?: AdminMediaAsset[];
  message?: string;
  ok?: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function parseOptionalMoney(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed.toFixed(2);
}

function parseRequiredMoney(value?: string) {
  return parseOptionalMoney(value) ?? "0.00";
}

function parseOptionalMetric(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePresetName(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function isPositiveMoney(value?: string) {
  const parsed = Number(value?.trim());

  return Number.isFinite(parsed) && parsed > 0;
}

function isCompareAtValid(price?: string, compareAtPrice?: string) {
  const normalizedCompareAt = compareAtPrice?.trim();

  if (!normalizedCompareAt) {
    return true;
  }

  const priceNumber = Number(price?.trim());
  const compareAtNumber = Number(normalizedCompareAt);

  return (
    Number.isFinite(priceNumber) &&
    Number.isFinite(compareAtNumber) &&
    compareAtNumber > priceNumber
  );
}

function parseStock(value?: string) {
  const parsed = Number(value?.trim() || "0");

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function buildVariantRows(input: ProductDraftInput) {
  if (input.hasVariants) {
    return input.variants.map((variant) => ({
      barcode: variant.barcode?.trim() || null,
      compareAtPrice: parseOptionalMoney(variant.compareAtPrice),
      continueSellingOutOfStock:
        input.fulfillmentMode === "piessang_fulfilled"
          ? false
          : variant.continueSellingOutOfStock,
      heightMm: parseOptionalMetric(variant.heightMm) ?? parseOptionalMetric(input.heightMm),
      imageId: variant.imageId ?? null,
      isActive: variant.status === "active",
      lengthMm: parseOptionalMetric(variant.lengthMm) ?? parseOptionalMetric(input.lengthMm),
      lowStockAlert:
        input.fulfillmentMode === "piessang_fulfilled"
          ? 0
          : parseStock(variant.lowStockAlert || "5"),
      notes: variant.notes?.trim() || null,
      optionValues: variant.optionValues,
      parcelPresetId: variant.parcelPresetId ?? input.parcelPresetId ?? null,
      price: parseRequiredMoney(variant.price || input.price),
      sku: variant.sku.trim(),
      status: variant.status,
      stockOnHand:
        input.fulfillmentMode === "piessang_fulfilled"
          ? 0
          : parseStock(variant.stock),
      title: variant.optionValues.join(" / ") || input.productName,
      weightGrams:
        parseOptionalMetric(variant.weightGrams) ?? parseOptionalMetric(input.weightGrams),
      widthMm: parseOptionalMetric(variant.widthMm) ?? parseOptionalMetric(input.widthMm),
    }));
  }

  return [
    {
      barcode: input.barcode?.trim() || null,
      compareAtPrice: parseOptionalMoney(input.compareAtPrice),
      continueSellingOutOfStock:
        input.fulfillmentMode === "piessang_fulfilled"
          ? false
          : input.continueSellingOutOfStock,
      heightMm: parseOptionalMetric(input.heightMm),
      imageId: input.mediaIds[0] ?? null,
      isActive: true,
      lengthMm: parseOptionalMetric(input.lengthMm),
      lowStockAlert: input.fulfillmentMode === "piessang_fulfilled" ? 0 : 5,
      notes: null,
      optionValues: [],
      parcelPresetId: input.parcelPresetId ?? null,
      price: parseRequiredMoney(input.price),
      sku: input.sku.trim(),
      status: "active" as const,
      stockOnHand:
        input.fulfillmentMode === "piessang_fulfilled" ? 0 : parseStock(input.stock),
      title: input.productName,
      weightGrams: parseOptionalMetric(input.weightGrams),
      widthMm: parseOptionalMetric(input.widthMm),
    },
  ];
}

async function getUniqueProductSlug(title: string, productId?: string | null) {
  const base = slugify(title) || "product";

  for (let index = 0; index < 25; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1);

    if (!existing || existing.id === productId) {
      return candidate;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function validateDraftForReview(input: ProductDraftInput, variantRows: ReturnType<typeof buildVariantRows>) {
  if (!input.categoryId) {
    return "Choose a category before submitting for review.";
  }

  if (!input.brandName?.trim()) {
    return "Choose or enter a brand before submitting for review.";
  }

  if (!input.description?.trim()) {
    return "Add a short description before submitting for review.";
  }

  if (!input.longDescription?.replace(/<[^>]*>/g, "").trim()) {
    return "Add a full description before submitting for review.";
  }

  if (input.mediaIds.length === 0) {
    return "Add at least one product image or video before submitting for review.";
  }

  if (input.hasVariants && input.variants.length === 0) {
    return "Generate the variants you sell before submitting for review.";
  }

  if (input.hasVariants && input.optionSchema.length === 0) {
    return "Add variant options before submitting for review.";
  }

  if (!input.hasVariants && !isPositiveMoney(input.price)) {
    return "Enter a VAT-inclusive price before submitting for review.";
  }

  if (!isCompareAtValid(input.price, input.compareAtPrice)) {
    return "Compare-at price must be higher than the selling price.";
  }

  const baseParcelValues = [
    input.weightGrams,
    input.lengthMm,
    input.widthMm,
    input.heightMm,
  ];

  if (baseParcelValues.some((value) => !parseOptionalMetric(value))) {
    return "Complete product parcel weight and dimensions before submitting for review.";
  }

  if (input.fulfillmentMode === "piessang_fulfilled" && !input.barcode?.trim()) {
    return "Add the product barcode before submitting an FBP product for review.";
  }

  for (const variant of variantRows) {
    if (!variant.sku.trim()) {
      return "Every variant must have a SKU before submitting for review.";
    }

    if (!isPositiveMoney(variant.price)) {
      return `Enter a VAT-inclusive price for ${variant.title}.`;
    }

    if (!isCompareAtValid(variant.price, variant.compareAtPrice ?? undefined)) {
      return `Compare-at price must be higher than the selling price for ${variant.title}.`;
    }

    if (
      !variant.weightGrams ||
      !variant.lengthMm ||
      !variant.widthMm ||
      !variant.heightMm
    ) {
      return `Complete parcel data for ${variant.title}.`;
    }

    if (input.fulfillmentMode === "piessang_fulfilled" && !variant.barcode) {
      return `Add a barcode for ${variant.title} before submitting an FBP product.`;
    }
  }

  return null;
}

function getResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      if (
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        const text = item.content
          .map((contentItem: unknown) =>
            typeof contentItem === "object" &&
            contentItem !== null &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
              ? contentItem.text
              : "",
          )
          .join("")
          .trim();

        if (text) {
          return text;
        }
      }
    }
  }

  return "";
}

function clampGeneratedText(value: string, maxLength: number) {
  return value.trim().replace(/^["']|["']$/g, "").slice(0, maxLength);
}

export async function generateProductDescription(input: {
  kind: "long" | "short";
  productName: string;
}) {
  await requireSellerDashboardAccess();

  const parsed = productDescriptionGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a product name before generating copy.",
    };
  }

  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      message: "OPENAI_API_KEY is not configured.",
    };
  }

  const isShort = parsed.data.kind === "short";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          `Product name: ${parsed.data.productName}`,
          isShort
            ? "Write one concise marketplace product short description under 400 characters."
            : "Write a helpful marketplace product description under 2000 characters.",
          "Keep it neutral, buyer-friendly, specific enough to be useful, and do not invent certifications, stock availability, delivery promises, discounts, warranties, dimensions, or ingredients.",
        ].join("\n"),
        instructions:
          "You write marketplace product copy for seller-submitted listings. Return only the product description text.",
        max_output_tokens: isShort ? 80 : 420,
        model: env.OPENAI_MODEL,
      }),
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "The AI generator is unavailable right now.",
      };
    }

    const description = clampGeneratedText(
      getResponseText(await response.json()),
      isShort ? 400 : 2000,
    );

    if (!description) {
      return {
        ok: false,
        message: "The AI generator did not return usable text.",
      };
    }

    return { ok: true, description };
  } catch {
    return {
      ok: false,
      message: "The AI generator timed out. Try again.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function saveProductDraft(input: ProductDraftInput) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return {
      ok: false,
      message: "Seller access could not be confirmed.",
    };
  }

  const parsed = productDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the product draft details.",
    };
  }

  const draft = parsed.data;

  if (
    draft.fulfillmentMode === "piessang_fulfilled" &&
    !seller.isPiessangFulfillmentEnabled
  ) {
    return {
      ok: false,
      message:
        "Fulfilled by Piessang is not enabled for this seller account yet.",
    };
  }

  const variantRows = buildVariantRows(draft);

  if (variantRows.length === 0) {
    return {
      ok: false,
      message: "Generate at least one variant before saving this product.",
    };
  }

  const normalizedSkuCounts = new Map<string, number>();

  for (const variant of variantRows) {
    const normalizedSku = variant.sku.toLowerCase();
    normalizedSkuCounts.set(
      normalizedSku,
      (normalizedSkuCounts.get(normalizedSku) ?? 0) + 1,
    );
  }

  if ([...normalizedSkuCounts.values()].some((count) => count > 1)) {
    return {
      ok: false,
      message: "Every variant SKU must be unique in this product.",
    };
  }

  const existingProduct = draft.productId
    ? await db
        .select({
          id: products.id,
          sellerId: products.sellerId,
          status: products.status,
        })
        .from(products)
        .where(eq(products.id, draft.productId))
        .limit(1)
        .then(([product]) => product ?? null)
    : null;

  if (draft.productId && (!existingProduct || existingProduct.sellerId !== seller.id)) {
    return {
      ok: false,
      message: "This product draft could not be confirmed.",
    };
  }

  if (
    existingProduct &&
    !["draft", "changes_requested"].includes(existingProduct.status)
  ) {
    return {
      ok: false,
      message: "This product cannot be edited as a draft in its current status.",
    };
  }

  const skus = variantRows.map((variant) => variant.sku);
  const conflictingSkus = await db
    .select({
      productId: productVariants.productId,
      sku: productVariants.sku,
    })
    .from(productVariants)
    .where(inArray(productVariants.sku, skus));

  const skuConflict = conflictingSkus.find(
    (variant) => !draft.productId || variant.productId !== draft.productId,
  );

  if (skuConflict) {
    return {
      ok: false,
      message: `SKU ${skuConflict.sku} is already in use.`,
    };
  }

  if (draft.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, draft.categoryId))
      .limit(1);

    if (!category) {
      return {
        ok: false,
        message: "Selected category could not be confirmed.",
      };
    }
  }

  const allMediaIds = [
    ...draft.mediaIds,
    ...variantRows
      .map((variant) => variant.imageId)
      .filter((mediaId): mediaId is string => Boolean(mediaId)),
  ];
  const uniqueMediaIds = [...new Set(allMediaIds)];
  const uniqueParcelPresetIds = [
    ...new Set(
      [
        draft.parcelPresetId,
        ...draft.variants.map((variant) => variant.parcelPresetId),
      ].filter((presetId): presetId is string => Boolean(presetId)),
    ),
  ];

  if (uniqueMediaIds.length > 0) {
    const ownedMedia = await db
      .select({ id: media.id })
      .from(media)
      .where(
        and(
          inArray(media.id, uniqueMediaIds),
          or(eq(media.ownerUserId, session.user.id), eq(media.sellerId, seller.id)),
        ),
      );

    if (ownedMedia.length !== uniqueMediaIds.length) {
      return {
        ok: false,
        message: "One or more selected media files could not be confirmed.",
      };
    }
  }

  if (uniqueParcelPresetIds.length > 0) {
    const ownedPresets = await db
      .select({ id: sellerParcelPresets.id })
      .from(sellerParcelPresets)
      .where(
        and(
          inArray(sellerParcelPresets.id, uniqueParcelPresetIds),
          eq(sellerParcelPresets.sellerId, seller.id),
          eq(sellerParcelPresets.isActive, true),
        ),
      );

    if (ownedPresets.length !== uniqueParcelPresetIds.length) {
      return {
        ok: false,
        message: "One or more parcel presets could not be confirmed.",
      };
    }
  }

  const brandName = draft.brandName?.trim();
  const brandSlug = brandName ? slugify(brandName) : "";
  let brandId: string | null = null;
  let brandRequestId: string | null = null;

  if (brandName && brandSlug) {
    const [existingBrand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, brandSlug))
      .limit(1);

    if (existingBrand) {
      brandId = existingBrand.id;
    } else {
      const [existingRequest] = await db
        .select({
          id: brandRequests.id,
          status: brandRequests.status,
        })
        .from(brandRequests)
        .where(
          and(
            eq(brandRequests.sellerId, seller.id),
            eq(brandRequests.slug, brandSlug),
          ),
        )
        .limit(1);

      if (existingRequest && existingRequest.status !== "pending") {
        return {
          ok: false,
          message: "This brand request already exists and is not pending.",
        };
      }

      if (existingRequest) {
        brandRequestId = existingRequest.id;
      } else {
        const [createdRequest] = await db
          .insert(brandRequests)
          .values({
            brandName,
            requestedByUserId: session.user.id,
            sellerId: seller.id,
            slug: brandSlug,
            status: "pending",
          })
          .returning({ id: brandRequests.id });

        brandRequestId = createdRequest?.id ?? null;
      }
    }
  }

  const now = new Date();
  const productSlug = await getUniqueProductSlug(draft.productName, draft.productId);

  const productId = await db.transaction(async (tx) => {
    const savedProductId = draft.productId
      ? draft.productId
      : await tx
          .insert(products)
          .values({
            brandId,
            brandRequestId,
            barcode: draft.barcode?.trim() || null,
            categoryId: draft.categoryId ?? null,
            description: draft.description || null,
            fulfillmentMode: draft.fulfillmentMode,
            fullDescription: draft.longDescription || null,
            optionSchema: draft.hasVariants ? draft.optionSchema : null,
            sellerId: seller.id,
            shortDescription: draft.description || null,
            slug: productSlug,
            status: "draft",
            title: draft.productName,
            updatedAt: now,
          })
          .returning({ id: products.id })
          .then(([product]) => product.id);

    if (draft.productId) {
      await tx
        .update(products)
        .set({
          brandId,
          brandRequestId,
          barcode: draft.barcode?.trim() || null,
          categoryId: draft.categoryId ?? null,
          description: draft.description || null,
          fulfillmentMode: draft.fulfillmentMode,
          fullDescription: draft.longDescription || null,
          optionSchema: draft.hasVariants ? draft.optionSchema : null,
          shortDescription: draft.description || null,
          slug: productSlug,
          status: "draft",
          title: draft.productName,
          updatedAt: now,
        })
        .where(eq(products.id, savedProductId));
    }

    await tx.delete(productMedia).where(eq(productMedia.productId, savedProductId));
    await tx
      .delete(productVariants)
      .where(eq(productVariants.productId, savedProductId));

    if (draft.mediaIds.length > 0) {
      await tx.insert(productMedia).values(
        draft.mediaIds.map((mediaId, index) => ({
          isCover: index === 0,
          mediaId,
          productId: savedProductId,
          sortOrder: index,
        })),
      );
    }

    await tx.insert(productVariants).values(
      variantRows.map((variant) => ({
        barcode: variant.barcode,
        compareAtPrice: variant.compareAtPrice,
        continueSellingOutOfStock: variant.continueSellingOutOfStock,
        heightMm: variant.heightMm,
        isActive: variant.isActive,
        lengthMm: variant.lengthMm,
        lowStockAlert: variant.lowStockAlert,
        mediaId: variant.imageId,
        notes: variant.notes,
        optionValues: variant.optionValues,
        parcelPresetId: variant.parcelPresetId,
        price: variant.price,
        productId: savedProductId,
        sku: variant.sku,
        status: variant.status,
        stockOnHand: variant.stockOnHand,
        title: variant.title,
        weightGrams: variant.weightGrams,
        widthMm: variant.widthMm,
      })),
    );

    return savedProductId;
  });

  revalidatePath("/seller/products");
  revalidatePath("/seller/products/new");

  return {
    ok: true,
    message: "Product saved.",
    productId,
  };
}

export async function submitProductForReview(input: ProductDraftInput) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return {
      ok: false,
      message: "Seller access could not be confirmed.",
    };
  }

  const parsed = productDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the product details first.",
    };
  }

  const draft = parsed.data;

  if (!draft.productId) {
    return {
      ok: false,
      message: "Save this product before submitting it for review.",
    };
  }

  const variantRows = buildVariantRows(draft);
  const reviewError = validateDraftForReview(draft, variantRows);

  if (reviewError) {
    return {
      ok: false,
      message: reviewError,
    };
  }

  if (
    draft.fulfillmentMode === "piessang_fulfilled" &&
    !seller.isPiessangFulfillmentEnabled
  ) {
    return {
      ok: false,
      message:
        "Fulfilled by Piessang is not enabled for this seller account yet.",
    };
  }

  let fromStatus: ProductLifecycleStatus | null = null;

  if (draft.productId) {
    const [existingProduct] = await db
      .select({
        sellerId: products.sellerId,
        status: products.status,
      })
      .from(products)
      .where(eq(products.id, draft.productId))
      .limit(1);

    if (!existingProduct || existingProduct.sellerId !== seller.id) {
      return {
        ok: false,
        message: "This product draft could not be confirmed.",
      };
    }

    if (!["draft", "changes_requested"].includes(existingProduct.status)) {
      return {
        ok: false,
        message:
          "Only draft products or products with requested changes can be submitted for review.",
      };
    }

    fromStatus = existingProduct.status;
  }

  const saved = await saveProductDraft(draft);

  if (!saved.ok || !saved.productId) {
    return saved;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        status: "pending_review",
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, saved.productId), eq(products.sellerId, seller.id)));

    await tx.insert(productReviewEvents).values({
      action: "submitted_for_review",
      actorUserId: session.user.id,
      fromStatus: fromStatus ?? "draft",
      note: "Seller submitted product for admin review.",
      productId: saved.productId,
      toStatus: "pending_review",
    });
  });

  revalidatePath("/seller/products");
  revalidatePath("/seller/products/new");

  await notifyAdminsProductSubmitted({
    productId: saved.productId,
    productTitle: draft.productName,
    sellerName: seller.displayName,
  });

  return {
    ok: true,
    message: "Product submitted for review.",
    productId: saved.productId,
  };
}

function getFileNameFromUrl(url: string, contentType: string) {
  const extensionFromType =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";

  try {
    const parsedUrl = new URL(url);
    const name = parsedUrl.pathname.split("/").pop()?.split("?")[0];

    if (name && /\.[a-z0-9]{2,5}$/i.test(name)) {
      return name.slice(0, 120);
    }
  } catch {
    // Fall back below.
  }

  return `imported-product-image.${extensionFromType}`;
}

async function fetchRemoteImage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.5",
        "User-Agent":
          "PiessangProductImporter/1.0 (+https://piessang.com; seller product import)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Remote image could not be downloaded.");
    }

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";

    if (!contentType.startsWith("image/")) {
      throw new Error("Remote file is not an image.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      contentHash: createHash("sha256").update(buffer).digest("hex"),
      file: new File(
        [new Uint8Array(buffer)],
        getFileNameFromUrl(url, contentType),
        { type: contentType },
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toImportedMediaAsset(row: {
  altText: string | null;
  byteSize: number;
  createdAt: Date;
  durationMs: number | null;
  folderId: string | null;
  height: number | null;
  id: string;
  mimeType: string;
  originalByteSize: number | null;
  originalFileName: string | null;
  relativePath: string;
  tags: string | null;
  thumbnailRelativePath: string | null;
  width: number | null;
}): AdminMediaAsset {
  return {
    altText: row.altText,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    durationMs: row.durationMs,
    folderId: row.folderId,
    folderIds: row.folderId ? [row.folderId] : [],
    height: row.height,
    id: row.id,
    mimeType: row.mimeType,
    originalByteSize: row.originalByteSize,
    originalFileName: row.originalFileName,
    publicUrl: getMediaPublicUrl(row.relativePath),
    tags: row.tags,
    thumbnailUrl: row.thumbnailRelativePath
      ? getMediaPublicUrl(row.thumbnailRelativePath)
      : null,
    usageCount: 0,
    width: row.width,
  };
}

export async function importProductLinkMedia(
  input: unknown,
): Promise<ImportedProductMediaState> {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { ok: false, message: "Seller access could not be confirmed." };
  }

  const parsed = importedMediaSchema.safeParse(input);

  if (!parsed.success || parsed.data.images.length === 0) {
    return { ok: false, message: "Choose at least one imported image." };
  }

  const assets: AdminMediaAsset[] = [];
  const failures: string[] = [];
  const assetsByHash = new Map<string, AdminMediaAsset>();
  let reusedCount = 0;

  for (const image of parsed.data.images) {
    try {
      const { contentHash, file } = await fetchRemoteImage(image.url);
      const currentImportAsset = assetsByHash.get(contentHash);

      if (currentImportAsset) {
        reusedCount += 1;
        continue;
      }

      const [existingAsset] = await db
        .select({
          altText: media.altText,
          byteSize: media.byteSize,
          createdAt: media.createdAt,
          durationMs: media.durationMs,
          folderId: media.folderId,
          height: media.height,
          id: media.id,
          mimeType: media.mimeType,
          originalByteSize: media.originalByteSize,
          originalFileName: media.originalFileName,
          relativePath: media.relativePath,
          tags: media.tags,
          thumbnailRelativePath: media.thumbnailRelativePath,
          width: media.width,
        })
        .from(media)
        .where(
          and(
            eq(media.ownerUserId, session.user.id),
            eq(media.contentHash, contentHash),
          ),
        )
        .limit(1);

      if (existingAsset) {
        const asset = toImportedMediaAsset(existingAsset);
        assets.push(asset);
        assetsByHash.set(contentHash, asset);
        reusedCount += 1;
        continue;
      }

      const asset = await processAndStoreMediaUpload({
        altText: image.alt,
        file,
        ownerUserId: session.user.id,
        scope: "seller-media",
      });

      assets.push(asset);
      assetsByHash.set(contentHash, asset);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Image failed.");
    }
  }

  revalidatePath("/seller/products/new");

  if (assets.length === 0) {
    return {
      ok: false,
      message:
        failures[0] ??
        "The product details imported, but the remote images could not be downloaded.",
    };
  }

  return {
    assets,
    ok: true,
    message:
      failures.length > 0
        ? `${assets.length} image${assets.length === 1 ? "" : "s"} ready. ${reusedCount} reused, ${failures.length} failed.`
        : reusedCount > 0
          ? `${assets.length} image${assets.length === 1 ? "" : "s"} ready. ${reusedCount} reused from your media library.`
          : `${assets.length} image${assets.length === 1 ? "" : "s"} imported.`,
  };
}

export async function createSellerParcelPreset(input: unknown): Promise<{
  message?: string;
  ok: boolean;
  preset?: {
    heightMm: number;
    id: string;
    isDefault: boolean;
    lengthMm: number;
    name: string;
    notes: string | null;
    weightGrams: number;
    widthMm: number;
  };
}> {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { ok: false, message: "Seller access could not be confirmed." };
  }

  const parsed = parcelPresetInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Complete the parcel preset details first." };
  }

  const weightGrams = parseOptionalMetric(parsed.data.weightGrams);
  const lengthMm = parseOptionalMetric(parsed.data.lengthMm);
  const widthMm = parseOptionalMetric(parsed.data.widthMm);
  const heightMm = parseOptionalMetric(parsed.data.heightMm);

  if (!weightGrams || !lengthMm || !widthMm || !heightMm) {
    return {
      ok: false,
      message: "Preset weight, length, width, and height are required.",
    };
  }

  const normalizedName = normalizePresetName(parsed.data.name);

  if (!normalizedName) {
    return { ok: false, message: "Use a clearer preset name." };
  }

  const existing = await db
    .select({ id: sellerParcelPresets.id })
    .from(sellerParcelPresets)
    .where(
      and(
        eq(sellerParcelPresets.sellerId, seller.id),
        eq(sellerParcelPresets.normalizedName, normalizedName),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return {
      ok: false,
      message: "A parcel preset with this name already exists.",
    };
  }

  const preset = await db.transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx
        .update(sellerParcelPresets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(sellerParcelPresets.sellerId, seller.id));
    }

    const [createdPreset] = await tx
      .insert(sellerParcelPresets)
      .values({
        heightMm,
        isDefault: parsed.data.isDefault,
        lengthMm,
        name: parsed.data.name,
        normalizedName,
        notes: parsed.data.notes?.trim() || null,
        sellerId: seller.id,
        weightGrams,
        widthMm,
      })
      .returning({
        heightMm: sellerParcelPresets.heightMm,
        id: sellerParcelPresets.id,
        isDefault: sellerParcelPresets.isDefault,
        lengthMm: sellerParcelPresets.lengthMm,
        name: sellerParcelPresets.name,
        notes: sellerParcelPresets.notes,
        weightGrams: sellerParcelPresets.weightGrams,
        widthMm: sellerParcelPresets.widthMm,
      });

    return createdPreset;
  });

  if (!preset) {
    return { ok: false, message: "Could not save this parcel preset." };
  }

  revalidatePath("/seller/products/new");

  return {
    ok: true,
    message: "Parcel preset saved.",
    preset,
  };
}
