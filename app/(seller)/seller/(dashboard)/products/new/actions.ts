"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import {
  auditLogs,
  brands,
  categories,
  media,
  productMedia,
  productReviewEvents,
  products,
  productVariants,
} from "@/src/db/schema";
import { processAndStoreMediaUpload } from "@/src/modules/media/admin";
import type { AdminMediaAsset } from "@/src/modules/media/admin";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getOpenAiIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  optionalCostPriceInputSchema,
  resolveOptionalCostPriceForSave,
} from "@/src/modules/products/cost-price";
import { reconcileProductVariantIdentities } from "@/src/modules/products/variant-reconciliation";
import { fulfillmentModeSchema } from "@/src/modules/shipping";

const productDescriptionGenerationSchema = z.object({
  brandName: z.string().trim().max(120).optional(),
  categoryName: z.string().trim().max(240).optional(),
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
const variantStatusSchema = z.enum(["active", "draft", "sold_out", "unavailable"]);
const googleFulfillmentChannelSchema = z.enum([
  "local_lpg",
  "national_courier",
  "excluded",
]);
const productPublishStatusSchema = z.enum(["active", "draft"]);
const productOptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  values: z.array(z.string().trim().min(1).max(80)).max(100),
});
const productDraftVariantSchema = z.object({
  barcode: z.string().trim().max(120).optional(),
  compareAtPrice: z.string().trim().max(40).optional(),
  continueSellingOutOfStock: z.boolean().default(false),
  costPrice: optionalCostPriceInputSchema,
  exchangeAcceptedReturnBrands: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .default([]),
  exchangeConfirmationText: z.string().trim().max(240).optional(),
  exchangeEmptyCylinderSize: z.string().trim().max(80).optional(),
  exchangeRequiresEmpty: z.boolean().default(false),
  googleFulfillmentChannel: googleFulfillmentChannelSchema.optional(),
  googleReturnPolicyLabel: z.string().trim().max(100).optional(),
  heightMm: z.string().trim().max(40).optional(),
  imageId: z.string().uuid().nullable().optional(),
  lengthMm: z.string().trim().max(40).optional(),
  lowStockAlert: z.string().trim().max(20).optional(),
  manufacturerMpn: z.string().trim().max(70).optional(),
  notes: z.string().trim().max(500).optional(),
  optionValues: z.array(z.string().trim().min(1).max(120)).max(20),
  parcelPresetId: z.string().uuid().nullable().optional(),
  persistedVariantId: z.string().uuid().nullable().optional(),
  price: z.string().trim().max(40).optional(),
  sku: z.string().trim().min(1).max(50),
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
  costPrice: optionalCostPriceInputSchema,
  description: z.string().trim().max(400).optional(),
  exchangeAcceptedReturnBrands: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .default([]),
  exchangeConfirmationText: z.string().trim().max(240).optional(),
  exchangeEmptyCylinderSize: z.string().trim().max(80).optional(),
  exchangeRequiresEmpty: z.boolean().default(false),
  fulfillmentMode: fulfillmentModeSchema,
  googleFulfillmentChannel: googleFulfillmentChannelSchema.optional(),
  googleReturnPolicyLabel: z.string().trim().max(100).optional(),
  hasVariants: z.boolean().default(false),
  heightMm: z.string().trim().max(40).optional(),
  lengthMm: z.string().trim().max(40).optional(),
  longDescription: z.string().max(12000).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).default([]),
  manufacturerMpn: z.string().trim().max(70).optional(),
  optionSchema: z.array(productOptionSchema).max(20).default([]),
  parcelPresetId: z.string().uuid().nullable().optional(),
  price: z.string().trim().max(40).optional(),
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(240),
  singleVariantId: z.string().uuid().nullable().optional(),
  sku: z.string().trim().min(1).max(50),
  status: productPublishStatusSchema.default("active"),
  stock: z.string().trim().max(20).optional(),
  variants: z.array(productDraftVariantSchema).max(250).default([]),
  weightGrams: z.string().trim().max(40).optional(),
  widthMm: z.string().trim().max(40).optional(),
});

type ProductDraftInput = z.input<typeof productDraftSchema>;
type ParsedProductDraftInput = z.output<typeof productDraftSchema>;
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

function parseStock(value?: string) {
  const parsed = Number(value?.trim() || "0");

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeExchangeBrands(brandsList: string[]) {
  const normalized = brandsList
    .map((brand) => brand.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

function getExchangeConfirmationText({
  customText,
  emptyCylinderSize,
  requiresExchangeEmpty,
}: {
  customText?: string;
  emptyCylinderSize?: string;
  requiresExchangeEmpty: boolean;
}) {
  if (!requiresExchangeEmpty) {
    return null;
  }

  const trimmedText = customText?.trim();

  if (trimmedText) {
    return trimmedText;
  }

  const sizeText = emptyCylinderSize?.trim();

  return sizeText
    ? `I confirm I have a ${sizeText} empty cylinder in acceptable condition to exchange on delivery.`
    : "I confirm I have an empty cylinder in acceptable condition to exchange on delivery.";
}

function buildVariantRows(
  input: ParsedProductDraftInput,
  existingVariants: Array<{
    costPrice: string | null;
    googleFulfillmentChannel: "excluded" | "local_lpg" | "national_courier";
    googleReturnPolicyLabel: string | null;
    id: string;
    manufacturerMpn: string | null;
    sku: string;
  }> = [],
  resolvedVariantIds: Array<string | null> = [],
) {
  const existingVariantById = new Map(
    existingVariants.map((variant) => [variant.id, variant]),
  );
  const existingVariantBySku = new Map(
    existingVariants.map((variant) => [variant.sku.toLowerCase(), variant]),
  );
  const existingSingleVariant =
    existingVariants.length === 1 ? existingVariants[0] : null;
  const existingSingleVariantCost =
    existingSingleVariant?.costPrice ?? null;
  const defaultGoogleFulfillmentChannel =
    input.fulfillmentMode === "seller_fulfilled"
      ? ("national_courier" as const)
      : ("local_lpg" as const);

  if (input.hasVariants) {
    return input.variants.map((variant, index) => {
      const sku = variant.sku.trim();
      const persistedVariantId = resolvedVariantIds[index] ?? null;
      const existingVariant = persistedVariantId
        ? existingVariantById.get(persistedVariantId)
        : existingVariantBySku.get(sku.toLowerCase());

      return {
        barcode: variant.barcode?.trim() || null,
        compareAtPrice: parseOptionalMoney(variant.compareAtPrice),
        continueSellingOutOfStock: variant.continueSellingOutOfStock,
        costPrice: resolveOptionalCostPriceForSave({
          existingCostPrice: existingVariant?.costPrice ?? null,
          input: variant.costPrice,
        }),
        exchangeAcceptedReturnBrands: variant.exchangeRequiresEmpty
          ? normalizeExchangeBrands(variant.exchangeAcceptedReturnBrands)
          : [],
        exchangeConfirmationText: getExchangeConfirmationText({
          customText: variant.exchangeConfirmationText,
          emptyCylinderSize: variant.exchangeEmptyCylinderSize,
          requiresExchangeEmpty: variant.exchangeRequiresEmpty,
        }),
        exchangeEmptyCylinderSize: variant.exchangeRequiresEmpty
          ? variant.exchangeEmptyCylinderSize?.trim() || null
          : null,
        exchangeRequiresEmpty: variant.exchangeRequiresEmpty,
        googleFulfillmentChannel:
          variant.googleFulfillmentChannel ??
          existingVariant?.googleFulfillmentChannel ??
          defaultGoogleFulfillmentChannel,
        googleReturnPolicyLabel:
          variant.googleReturnPolicyLabel === undefined
            ? existingVariant?.googleReturnPolicyLabel ?? null
            : variant.googleReturnPolicyLabel || null,
        heightMm:
          parseOptionalMetric(variant.heightMm) ??
          parseOptionalMetric(input.heightMm),
        imageId: variant.imageId ?? null,
        isActive: variant.status === "active",
        lengthMm:
          parseOptionalMetric(variant.lengthMm) ??
          parseOptionalMetric(input.lengthMm),
        lowStockAlert: parseStock(variant.lowStockAlert || "5"),
        manufacturerMpn:
          variant.manufacturerMpn === undefined
            ? existingVariant?.manufacturerMpn ?? null
            : variant.manufacturerMpn || null,
        notes: variant.notes?.trim() || null,
        optionValues: variant.optionValues,
        parcelPresetId: variant.parcelPresetId ?? input.parcelPresetId ?? null,
        persistedVariantId,
        price: parseRequiredMoney(variant.price || input.price),
        sku,
        status: variant.status,
        stockOnHand: parseStock(variant.stock),
        title: variant.optionValues.join(" / ") || input.productName,
        weightGrams:
          parseOptionalMetric(variant.weightGrams) ??
          parseOptionalMetric(input.weightGrams),
        widthMm:
          parseOptionalMetric(variant.widthMm) ??
          parseOptionalMetric(input.widthMm),
      };
    });
  }

  const sku = input.sku.trim();
  const persistedVariantId = resolvedVariantIds[0] ?? null;
  const existingVariant = persistedVariantId
    ? existingVariantById.get(persistedVariantId)
    : existingVariantBySku.get(sku.toLowerCase()) ?? existingSingleVariant;

  return [
    {
      barcode: input.barcode?.trim() || null,
      compareAtPrice: parseOptionalMoney(input.compareAtPrice),
      continueSellingOutOfStock: input.continueSellingOutOfStock,
      costPrice: resolveOptionalCostPriceForSave({
        existingCostPrice:
          existingVariant?.costPrice ?? existingSingleVariantCost,
        input: input.costPrice,
      }),
      exchangeAcceptedReturnBrands: input.exchangeRequiresEmpty
        ? normalizeExchangeBrands(input.exchangeAcceptedReturnBrands)
        : [],
      exchangeConfirmationText: getExchangeConfirmationText({
        customText: input.exchangeConfirmationText,
        emptyCylinderSize: input.exchangeEmptyCylinderSize,
        requiresExchangeEmpty: input.exchangeRequiresEmpty,
      }),
      exchangeEmptyCylinderSize: input.exchangeRequiresEmpty
        ? input.exchangeEmptyCylinderSize?.trim() || null
        : null,
      exchangeRequiresEmpty: input.exchangeRequiresEmpty,
      googleFulfillmentChannel:
        input.googleFulfillmentChannel ??
        existingVariant?.googleFulfillmentChannel ??
        defaultGoogleFulfillmentChannel,
      googleReturnPolicyLabel:
        input.googleReturnPolicyLabel === undefined
          ? existingVariant?.googleReturnPolicyLabel ?? null
          : input.googleReturnPolicyLabel || null,
      heightMm: parseOptionalMetric(input.heightMm),
      imageId: input.mediaIds[0] ?? null,
      isActive: true,
      lengthMm: parseOptionalMetric(input.lengthMm),
      lowStockAlert: 5,
      manufacturerMpn:
        input.manufacturerMpn === undefined
          ? existingVariant?.manufacturerMpn ?? null
          : input.manufacturerMpn || null,
      notes: null,
      optionValues: [],
      parcelPresetId: input.parcelPresetId ?? null,
      persistedVariantId,
      price: parseRequiredMoney(input.price),
      sku,
      status: "active" as const,
      stockOnHand: parseStock(input.stock),
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

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getStringProperty(value: unknown, key: string) {
  const record = asRecord(value);
  const property = record?.[key];

  return typeof property === "string" ? property : "";
}

function getResponseText(payload: unknown) {
  const topLevelText = getStringProperty(payload, "output_text").trim();

  if (topLevelText) {
    return topLevelText;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      const itemText = getStringProperty(item, "text").trim();

      if (itemText) {
        return itemText;
      }

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

  const choices = asRecord(payload)?.choices;

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const choiceRecord = asRecord(choice);
      const message = asRecord(choiceRecord?.message);
      const content = message?.content;

      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
    }
  }

  return "";
}

function clampGeneratedText(value: string, maxLength: number) {
  return value.trim().replace(/^["']|["']$/g, "").slice(0, maxLength);
}

function getOpenAiResponseIssue(payload: unknown) {
  const record = asRecord(payload);
  const error = asRecord(record?.error);
  const errorMessage = getStringProperty(error, "message");

  if (errorMessage) {
    return errorMessage;
  }

  const status = getStringProperty(record, "status");
  const incompleteDetails = asRecord(record?.incomplete_details);
  const incompleteReason = getStringProperty(incompleteDetails, "reason");

  if (status === "incomplete" && incompleteReason === "max_output_tokens") {
    return "The AI draft ran out of output budget. Try again.";
  }

  if (status === "failed") {
    return "The AI generator failed before returning text. Try again.";
  }

  return "";
}

async function requireCatalogManageSession() {
  const access = await requireAdminCapability("admin.catalog.manage");

  return access.ok ? access.session : null;
}

export async function generateProductDescription(input: {
  brandName?: string;
  categoryName?: string;
  kind: "long" | "short";
  productName: string;
}) {
  const session = await requireCatalogManageSession();

  if (!session) {
    return {
      ok: false,
      message: "Catalog access could not be confirmed.",
    };
  }

  const parsed = productDescriptionGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a product name before generating copy.",
    };
  }

  const openAiConfig = await getOpenAiIntegrationConfig();

  if (!openAiConfig.isConfigured || !openAiConfig.apiKey) {
    return {
      ok: false,
      message: "ChatGPT integration is disabled or missing an OpenAI API key.",
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
          parsed.data.brandName ? `Brand: ${parsed.data.brandName}` : null,
          parsed.data.categoryName ? `Category: ${parsed.data.categoryName}` : null,
          isShort
            ? "Write one direct marketplace product-card short description in one sentence under 240 characters."
            : "Write a helpful marketplace product description under 2000 characters.",
          "Keep it neutral, buyer-friendly, specific enough to be useful, and do not invent certifications, stock availability, delivery promises, discounts, warranties, dimensions, or ingredients.",
        ]
          .filter(Boolean)
          .join("\n"),
        instructions:
          "You write concise marketplace product copy for catalog listings. Return only the product description text.",
        max_output_tokens: isShort ? 240 : 900,
        model: openAiConfig.model,
      }),
      headers: {
        Authorization: `Bearer ${openAiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    const responsePayload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          getOpenAiResponseIssue(responsePayload) ||
          `The AI generator is unavailable right now. (${response.status})`,
      };
    }

    const description = clampGeneratedText(
      getResponseText(responsePayload),
      isShort ? 400 : 2000,
    );

    if (!description) {
      return {
        ok: false,
        message:
          getOpenAiResponseIssue(responsePayload) ||
          "OpenAI returned an empty draft. Try again after adding more product details.",
      };
    }

    return { ok: true, description };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "The AI generator timed out. Try again."
          : "The AI generator failed. Try again.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function saveProductDraft(input: ProductDraftInput) {
  const session = await requireCatalogManageSession();

  if (!session) {
    return {
      ok: false,
      message: "Catalog access could not be confirmed.",
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
  const [existingProduct, existingVariants] = draft.productId
    ? await Promise.all([
        db
          .select({
            id: products.id,
            status: products.status,
          })
          .from(products)
          .where(eq(products.id, draft.productId))
          .limit(1)
          .then(([product]) => product ?? null),
        db
          .select({
            costPrice: productVariants.costPrice,
            googleFulfillmentChannel:
              productVariants.googleFulfillmentChannel,
            googleReturnPolicyLabel: productVariants.googleReturnPolicyLabel,
            id: productVariants.id,
            manufacturerMpn: productVariants.manufacturerMpn,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .where(eq(productVariants.productId, draft.productId)),
      ])
    : [null, []];

  if (draft.productId && !existingProduct) {
    return {
      ok: false,
      message: "This product draft could not be confirmed.",
    };
  }

  if (
    existingProduct &&
    ["archived", "admin_suspended"].includes(existingProduct.status)
  ) {
    return {
      ok: false,
      message: "Archived or suspended products cannot be edited here.",
    };
  }

  const submittedVariantIdentities = draft.hasVariants
    ? draft.variants.map((variant) => ({
        persistedVariantId: variant.persistedVariantId,
        sku: variant.sku,
      }))
    : [
        {
          persistedVariantId: draft.singleVariantId,
          sku: draft.sku,
        },
      ];
  const variantIdentityResult = reconcileProductVariantIdentities({
    existingVariants,
    fallbackToOnlyExistingVariant: !draft.hasVariants,
    submittedVariants: submittedVariantIdentities,
  });

  if (!variantIdentityResult.ok) {
    return variantIdentityResult;
  }

  const variantRows = buildVariantRows(
    draft,
    existingVariants,
    variantIdentityResult.resolvedVariantIds,
  );

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

  const skus = variantRows.map((variant) => variant.sku);
  const conflictingSkus = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
    })
    .from(productVariants)
    .where(inArray(productVariants.sku, skus));

  const resolvedVariantIdBySku = new Map(
    variantRows.map((variant) => [
      variant.sku.toLowerCase(),
      variant.persistedVariantId,
    ]),
  );
  const skuConflict = conflictingSkus.find((variant) => {
    const resolvedVariantId = resolvedVariantIdBySku.get(
      variant.sku.toLowerCase(),
    );

    return (
      variant.id !== resolvedVariantId &&
      variant.productId !== draft.productId
    );
  });

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
          eq(media.ownerUserId, session.user.id),
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
    return {
      ok: false,
      message: "Parcel presets are retired for the single-store catalog.",
    };
  }

  const brandName = draft.brandName?.trim();
  const brandSlug = brandName ? slugify(brandName) : "";
  let brandId: string | null = null;
  const brandRequestId: string | null = null;

  if (!brandName || !brandSlug) {
    return {
      ok: false,
      message: "Select a preset brand before saving this product.",
    };
  }

  const [existingBrand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.slug, brandSlug), eq(brands.status, "active")))
    .limit(1);

  if (!existingBrand) {
    return {
      ok: false,
      message:
        "Select an active preset brand from Catalog > Brands before saving this product.",
    };
  }

  brandId = existingBrand.id;

  const now = new Date();
  const productSlug = await getUniqueProductSlug(draft.productName, draft.productId);
  const nextProductStatus = draft.status;

  let savedProduct: { productId: string; variantIds: string[] };

  try {
    savedProduct = await db.transaction(async (tx) => {
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
              shortDescription: draft.description || null,
              slug: productSlug,
              status: nextProductStatus,
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
            status: nextProductStatus,
            title: draft.productName,
            updatedAt: now,
          })
          .where(eq(products.id, savedProductId));
      }

      await tx
        .delete(productMedia)
        .where(eq(productMedia.productId, savedProductId));

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

      const variantsWithChangedSkus = variantRows.filter((variant) => {
        if (!variant.persistedVariantId) {
          return false;
        }

        const existingVariant = existingVariants.find(
          (candidate) => candidate.id === variant.persistedVariantId,
        );

        return existingVariant?.sku !== variant.sku;
      });

      for (const variant of variantsWithChangedSkus) {
        await tx
          .update(productVariants)
          .set({ sku: `saving-${crypto.randomUUID()}` })
          .where(
            and(
              eq(productVariants.id, variant.persistedVariantId!),
              eq(productVariants.productId, savedProductId),
            ),
          );
      }

      for (const retiredVariantId of variantIdentityResult.retiredVariantIds) {
        await tx
          .update(productVariants)
          .set({
            isActive: false,
            sku: `retired-${retiredVariantId}`,
            status: "retired",
            stockOnHand: 0,
          })
          .where(
            and(
              eq(productVariants.id, retiredVariantId),
              eq(productVariants.productId, savedProductId),
            ),
          );
      }

      const savedVariantIds: string[] = [];

      for (const variant of variantRows) {
        const variantValues = {
          barcode: variant.barcode,
          compareAtPrice: variant.compareAtPrice,
          continueSellingOutOfStock: variant.continueSellingOutOfStock,
          costPrice: variant.costPrice,
          exchangeAcceptedReturnBrands: variant.exchangeAcceptedReturnBrands,
          exchangeConfirmationText: variant.exchangeConfirmationText,
          exchangeEmptyCylinderSize: variant.exchangeEmptyCylinderSize,
          googleFulfillmentChannel: variant.googleFulfillmentChannel,
          googleReturnPolicyLabel: variant.googleReturnPolicyLabel,
          requiresExchangeEmpty: variant.exchangeRequiresEmpty,
          heightMm: variant.heightMm,
          isActive: variant.isActive,
          lengthMm: variant.lengthMm,
          lowStockAlert: variant.lowStockAlert,
          manufacturerMpn: variant.manufacturerMpn,
          mediaId: variant.imageId,
          notes: variant.notes,
          optionValues: variant.optionValues,
          parcelPresetId: variant.parcelPresetId,
          price: variant.price,
          sku: variant.sku,
          status: variant.status,
          stockOnHand: variant.stockOnHand,
          title: variant.title,
          weightGrams: variant.weightGrams,
          widthMm: variant.widthMm,
        };

        if (variant.persistedVariantId) {
          const [updatedVariant] = await tx
            .update(productVariants)
            .set(variantValues)
            .where(
              and(
                eq(productVariants.id, variant.persistedVariantId),
                eq(productVariants.productId, savedProductId),
              ),
            )
            .returning({ id: productVariants.id });

          if (!updatedVariant) {
            throw new Error("A saved product variant could not be updated.");
          }

          savedVariantIds.push(updatedVariant.id);
          continue;
        }

        const [insertedVariant] = await tx
          .insert(productVariants)
          .values({
            ...variantValues,
            productId: savedProductId,
          })
          .returning({ id: productVariants.id });

        savedVariantIds.push(insertedVariant.id);
      }

      await tx.insert(productReviewEvents).values({
        action:
          nextProductStatus === "draft" ? "saved_as_draft" : "saved_as_active",
        actorUserId: session.user.id,
        fromStatus: existingProduct?.status ?? null,
        note:
          nextProductStatus === "draft"
            ? "Admin saved product as draft."
            : "Admin saved product as active.",
        productId: savedProductId,
        toStatus: nextProductStatus,
      });

      await tx.insert(auditLogs).values({
        action:
          nextProductStatus === "draft"
            ? "product.saved_as_draft"
            : "product.saved_as_active",
        actorUserId: session.user.id,
        entityId: savedProductId,
        entityType: "product",
        metadata: JSON.stringify({
          fromStatus: existingProduct?.status ?? null,
          title: draft.productName,
          toStatus: nextProductStatus,
        }),
      });

      return { productId: savedProductId, variantIds: savedVariantIds };
    });
  } catch (error) {
    console.error("Failed to save product draft", error);

    return {
      ok: false,
      message: "The product could not be saved. No changes were applied.",
    };
  }

  revalidatePath("/admin/products/all");
  revalidatePath("/admin/products/new");
  revalidatePath("/products");
  revalidatePath("/products/all");
  revalidatePath("/products/new");
  revalidatePath(`/products/${productSlug}`);

  return {
    ok: true,
    message:
      nextProductStatus === "draft"
        ? "Product saved as draft."
        : "Product saved as active.",
    productId: savedProduct.productId,
    variantIds: savedProduct.variantIds,
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
          "JurgensEnergyProductImporter/1.0 (+https://jurgensenergy.com; product import)",
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
  const session = await requireCatalogManageSession();

  if (!session) {
    return { ok: false, message: "Catalog access could not be confirmed." };
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
        scope: "admin-media",
      });

      assets.push(asset);
      assetsByHash.set(contentHash, asset);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Image failed.");
    }
  }

  revalidatePath("/admin/products/new");
  revalidatePath("/products/new");

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
  void input;

  return {
    ok: false,
    message:
      "Parcel presets are retired for the single-store catalog. Enter parcel dimensions directly on the product.",
  };
}
