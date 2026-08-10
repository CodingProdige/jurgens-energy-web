import { revalidatePath } from "next/cache";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  or,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { lucideCampaignIconNames } from "@/src/generated/lucide-campaign-icon-names";
import {
  auditLogs,
  brands,
  categories,
  media,
  productMedia,
  productVariants,
  products,
  saleCampaigns,
  saleCampaignVariants,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import { getFriendlySalesErrorMessage } from "@/src/modules/sales/database-errors";

const saleCampaignBadgeIconNameSet = new Set<string>(
  lucideCampaignIconNames,
);

const saleCampaignColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Choose a valid six-digit hex colour.")
  .transform((value) => value.toUpperCase());

const nullableSaleCampaignTextSchema = (maximumLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? null : value,
    z.string().trim().min(1).max(maximumLength).nullable().default(null),
  );

const saleCampaignBadgeIconSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? null : value,
  z
    .string()
    .trim()
    .max(80)
    .refine(
      (value) => saleCampaignBadgeIconNameSet.has(value),
      "Choose a valid Lucide icon.",
    )
    .nullable()
    .default(null),
);

const saleCampaignAppearanceFieldsSchema = z.object({
  badgeColor: saleCampaignColorSchema.default("#FF5A1F"),
  badgeIcon: saleCampaignBadgeIconSchema,
  ctaLabel: z.string().trim().min(1).max(80).default("Shop sale"),
  headerPriority: z.coerce.number().int().min(0).max(32767).default(0),
  headerVisible: z.boolean().default(true),
  publicHeadline: nullableSaleCampaignTextSchema(200),
});

const createSaleCampaignSchema = z.object({
  badgeText: z.string().trim().min(1).max(80).default("Sale"),
  discountPercent: z.coerce.number().min(1).max(95),
  name: z.string().trim().min(1).max(160),
  variantIds: z.array(z.string().uuid()).min(1).max(200),
}).extend(saleCampaignAppearanceFieldsSchema.shape);

const saleCampaignIdSchema = z.object({
  campaignId: z.string().uuid(),
});

const updateSaleCampaignAppearanceSchema = saleCampaignIdSchema.extend(
  saleCampaignAppearanceFieldsSchema.shape,
);

export type SaleCampaignAppearanceInput = z.infer<
  typeof saleCampaignAppearanceFieldsSchema
>;

export type CreateSaleCampaignInput = z.infer<
  typeof createSaleCampaignSchema
>;

export type UpdateSaleCampaignAppearanceInput = z.infer<
  typeof updateSaleCampaignAppearanceSchema
>;

export type SaleActionResult = {
  message?: string;
  ok: boolean;
};

export type AdminSaleAvailabilityCode =
  | "active_campaign"
  | "compare_at_sale"
  | "eligible"
  | "invalid_price"
  | "product_inactive"
  | "variant_inactive";

export type AdminSaleVariant = {
  activeCampaignId: string | null;
  activeCampaignName: string | null;
  availabilityCode: AdminSaleAvailabilityCode;
  compareAtPrice: string | null;
  costPrice: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  optionValues: string[];
  price: string;
  productId: string;
  productSlug: string;
  productStatus: string;
  productTitle: string;
  selectable: boolean;
  sku: string;
  status: string;
  stockOnHand: number;
  title: string;
  unavailableReason: string | null;
};

export type AdminSaleProduct = {
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryPath: string | null;
  coverMediaUrl: string | null;
  id: string;
  slug: string;
  status: string;
  title: string;
  variants: AdminSaleVariant[];
};

export type AdminSaleCampaignVariant = {
  originalCompareAtPrice: string | null;
  originalPrice: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  salePrice: string;
  sku: string;
  title: string;
  variantId: string;
};

export type AdminSaleCampaign = {
  badgeColor: string;
  badgeIcon: string | null;
  badgeText: string;
  ctaLabel: string;
  createdAt: string;
  discountPercent: string;
  headerPriority: number;
  headerVisible: boolean;
  id: string;
  name: string;
  publicHeadline: string | null;
  status: "active" | "ended";
  variants: AdminSaleCampaignVariant[];
};

export type AdminSalesData = {
  activeCampaigns: AdminSaleCampaign[];
  products: AdminSaleProduct[];
  publicSaleUrl: string;
  salesAvailable: boolean;
  salesUnavailableMessage: string | null;
};

type VariantForSale = {
  compareAtPrice: string | null;
  costPrice: string | null;
  id: string;
  isActive: boolean;
  price: string;
  productId: string;
  productSlug: string;
  productStatus: string;
  productTitle: string;
  sku: string;
  status: string;
  stockOnHand: number;
  title: string;
};

type ActiveSaleRow = {
  badgeColor: string;
  badgeIcon: string | null;
  badgeText: string;
  campaignId: string;
  campaignName: string;
  ctaLabel: string;
  createdAt: Date;
  discountPercent: string;
  headerPriority: number;
  headerVisible: boolean;
  originalCompareAtPrice: string | null;
  originalPrice: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  publicHeadline: string | null;
  salePrice: string;
  sku: string;
  title: string;
  variantId: string;
};

type ActiveSaleCampaignHeader = {
  badgeColor: string;
  badgeIcon: string | null;
  badgeText: string;
  ctaLabel: string;
  createdAt: Date;
  discountPercent: string;
  headerPriority: number;
  headerVisible: boolean;
  id: string;
  name: string;
  publicHeadline: string | null;
};

const publicProductStatuses = new Set(["active", "live"]);

type SaleAvailability = {
  availabilityCode: AdminSaleAvailabilityCode;
  selectable: boolean;
  unavailableReason: string | null;
};

type MediaImageRow = {
  mimeType: string | null;
  relativePath: string | null;
  thumbnailRelativePath: string | null;
};

function toMoney(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function toNumber(value: string | null | undefined) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function getDiscountedPrice(price: number, discountPercent: number) {
  const discountedCents = Math.max(
    1,
    Math.round(price * 100 * (1 - discountPercent / 100)),
  );

  return (discountedCents / 100).toFixed(2);
}

function getMediaImageUrl({
  mimeType,
  relativePath,
  thumbnailRelativePath,
}: MediaImageRow) {
  if (mimeType?.startsWith("video/")) {
    return thumbnailRelativePath
      ? getMediaPublicUrl(thumbnailRelativePath)
      : null;
  }

  if (!mimeType?.startsWith("image/")) {
    return null;
  }

  const imagePath = thumbnailRelativePath ?? relativePath;

  return imagePath ? getMediaPublicUrl(imagePath) : null;
}

function variantHasCompareAtSale(variant: { compareAtPrice: string | null; price: string }) {
  const price = toNumber(variant.price);
  const compareAtPrice = toNumber(variant.compareAtPrice);

  return (
    price !== null &&
    compareAtPrice !== null &&
    compareAtPrice > price
  );
}

function getSaleAvailability(
  variant: VariantForSale,
  activeSaleByVariantId: ReadonlyMap<string, ActiveSaleRow>,
): SaleAvailability {
  const activeSale = activeSaleByVariantId.get(variant.id);

  if (activeSale) {
    return {
      availabilityCode: "active_campaign",
      selectable: false,
      unavailableReason: `Already on ${activeSale.campaignName}.`,
    };
  }

  if (!publicProductStatuses.has(variant.productStatus)) {
    return {
      availabilityCode: "product_inactive",
      selectable: false,
      unavailableReason: "Product is not active.",
    };
  }

  if (variant.status !== "active" || !variant.isActive) {
    return {
      availabilityCode: "variant_inactive",
      selectable: false,
      unavailableReason: "Variant is not active.",
    };
  }

  const price = toNumber(variant.price);

  if (price === null || price <= 0) {
    return {
      availabilityCode: "invalid_price",
      selectable: false,
      unavailableReason: "Variant has no valid price.",
    };
  }

  if (variantHasCompareAtSale(variant)) {
    return {
      availabilityCode: "compare_at_sale",
      selectable: false,
      unavailableReason: "Already has compare-at sale pricing.",
    };
  }

  return {
    availabilityCode: "eligible",
    selectable: true,
    unavailableReason: null,
  };
}

async function getActiveSaleRows(variantIds?: string[], campaignId?: string) {
  const baseFilters = [
    eq(saleCampaigns.status, "active" as const),
    eq(saleCampaignVariants.status, "active" as const),
  ];

  if (variantIds) {
    baseFilters.push(inArray(saleCampaignVariants.variantId, variantIds));
  }

  if (campaignId) {
    baseFilters.push(eq(saleCampaigns.id, campaignId));
  }

  const whereCondition = and(...baseFilters);

  if (variantIds && variantIds.length === 0) {
    return {
      ok: true as const,
      rows: [] as ActiveSaleRow[],
    };
  }

  try {
    const rows = await db
      .select({
        badgeColor: saleCampaigns.badgeColor,
        badgeIcon: saleCampaigns.badgeIcon,
        badgeText: saleCampaigns.badgeText,
        campaignId: saleCampaigns.id,
        campaignName: saleCampaigns.name,
        ctaLabel: saleCampaigns.ctaLabel,
        createdAt: saleCampaigns.createdAt,
        discountPercent: saleCampaigns.discountPercent,
        headerPriority: saleCampaigns.headerPriority,
        headerVisible: saleCampaigns.headerVisible,
        originalCompareAtPrice: saleCampaignVariants.originalCompareAtPrice,
        originalPrice: saleCampaignVariants.originalPrice,
        productId: products.id,
        productSlug: products.slug,
        productTitle: products.title,
        publicHeadline: saleCampaigns.publicHeadline,
        salePrice: saleCampaignVariants.salePrice,
        sku: productVariants.sku,
        title: productVariants.title,
        variantId: saleCampaignVariants.variantId,
      })
      .from(saleCampaignVariants)
      .innerJoin(
        saleCampaigns,
        eq(saleCampaigns.id, saleCampaignVariants.campaignId),
      )
      .innerJoin(productVariants, eq(productVariants.id, saleCampaignVariants.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(whereCondition)
      .orderBy(
        desc(saleCampaigns.createdAt),
        asc(products.title),
        asc(productVariants.title),
      );

    return {
      ok: true as const,
      rows,
    };
  } catch (error: unknown) {
    console.error("Failed to load active sale rows:", error);

    return {
      message: getFriendlySalesErrorMessage("read", error),
      ok: false as const,
      rows: [] as ActiveSaleRow[],
    };
  }
}

async function getActiveSaleCampaignHeaders(campaignId?: string) {
  try {
    const rows = await db
      .select({
        badgeColor: saleCampaigns.badgeColor,
        badgeIcon: saleCampaigns.badgeIcon,
        badgeText: saleCampaigns.badgeText,
        ctaLabel: saleCampaigns.ctaLabel,
        createdAt: saleCampaigns.createdAt,
        discountPercent: saleCampaigns.discountPercent,
        headerPriority: saleCampaigns.headerPriority,
        headerVisible: saleCampaigns.headerVisible,
        id: saleCampaigns.id,
        name: saleCampaigns.name,
        publicHeadline: saleCampaigns.publicHeadline,
      })
      .from(saleCampaigns)
      .where(
        campaignId
          ? and(
              eq(saleCampaigns.status, "active" as const),
              eq(saleCampaigns.id, campaignId),
            )
          : eq(saleCampaigns.status, "active" as const),
      )
      .orderBy(
        desc(saleCampaigns.headerPriority),
        desc(saleCampaigns.createdAt),
      );

    return {
      ok: true as const,
      rows: rows satisfies ActiveSaleCampaignHeader[],
    };
  } catch (error: unknown) {
    console.error("Failed to load active sale campaign headers:", error);

    return {
      message: getFriendlySalesErrorMessage("read", error),
      ok: false as const,
      rows: [] as ActiveSaleCampaignHeader[],
    };
  }
}

function revalidateSalePaths(productSlugs: Iterable<string>) {
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/all");
  revalidatePath("/admin/products/sales");
  revalidatePath("/products");
  revalidatePath("/products/all");
  revalidatePath("/sale");
  revalidatePath("/feeds/google-merchant.xml");

  for (const slug of new Set(productSlugs)) {
    revalidatePath(`/products/${slug}`);
  }
}

export async function getAdminSalesData(): Promise<AdminSalesData> {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      activeCampaigns: [],
      products: [],
      publicSaleUrl: createMarketplaceCanonicalUrl("/sale"),
      salesAvailable: false,
      salesUnavailableMessage: "You do not have permission to manage product sales.",
    };
  }

  const [activeSaleResult, activeCampaignHeaderResult] = await Promise.all([
    getActiveSaleRows(),
    getActiveSaleCampaignHeaders(),
  ]);
  const activeSaleRows = activeSaleResult.rows;

  const [productRows, variantRows, productMediaRows] = await Promise.all([
    db
      .select({
        brandId: products.brandId,
        brandName: brands.name,
        categoryId: products.categoryId,
        categoryPath: categories.path,
        id: products.id,
        slug: products.slug,
        status: products.status,
        title: products.title,
      })
      .from(products)
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .orderBy(asc(products.title)),
    db
      .select({
        compareAtPrice: productVariants.compareAtPrice,
        costPrice: productVariants.costPrice,
        id: productVariants.id,
        isActive: productVariants.isActive,
        mediaMimeType: media.mimeType,
        mediaRelativePath: media.relativePath,
        mediaThumbnailRelativePath: media.thumbnailRelativePath,
        optionValues: productVariants.optionValues,
        price: productVariants.price,
        productId: productVariants.productId,
        productSlug: products.slug,
        productStatus: products.status,
        productTitle: products.title,
        sku: productVariants.sku,
        status: productVariants.status,
        stockOnHand: productVariants.stockOnHand,
        title: productVariants.title,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(
        media,
        and(
          eq(media.id, productVariants.mediaId),
          eq(media.isPublic, true),
        ),
      )
      .orderBy(asc(products.title), asc(productVariants.title)),
    db
      .selectDistinctOn([productMedia.productId], {
        isCover: productMedia.isCover,
        mediaId: productMedia.mediaId,
        mimeType: media.mimeType,
        productId: productMedia.productId,
        relativePath: media.relativePath,
        sortOrder: productMedia.sortOrder,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(
        and(
          eq(media.isPublic, true),
          or(
            like(media.mimeType, "image/%"),
            and(
              like(media.mimeType, "video/%"),
              isNotNull(media.thumbnailRelativePath),
            ),
          ),
        ),
      )
      .orderBy(
        asc(productMedia.productId),
        desc(productMedia.isCover),
        asc(productMedia.sortOrder),
        asc(productMedia.mediaId),
      ),
  ]);

  const activeSaleByVariantId = new Map(
    activeSaleRows.map((row) => [row.variantId, row]),
  );
  const coverMediaUrlByProductId = new Map<string, string>();

  for (const row of productMediaRows) {
    if (coverMediaUrlByProductId.has(row.productId)) {
      continue;
    }

    const imageUrl = getMediaImageUrl(row);

    if (imageUrl) {
      coverMediaUrlByProductId.set(row.productId, imageUrl);
    }
  }

  const variantsByProductId = new Map<string, AdminSaleVariant[]>();

  for (const variant of variantRows) {
    const activeSale = activeSaleByVariantId.get(variant.id) ?? null;
    const availability = getSaleAvailability(variant, activeSaleByVariantId);
    const variants = variantsByProductId.get(variant.productId) ?? [];

    variants.push({
      activeCampaignId: activeSale?.campaignId ?? null,
      activeCampaignName: activeSale?.campaignName ?? null,
      availabilityCode: availability.availabilityCode,
      compareAtPrice: variant.compareAtPrice,
      costPrice: variant.costPrice,
      id: variant.id,
      imageUrl:
        getMediaImageUrl({
          mimeType: variant.mediaMimeType,
          relativePath: variant.mediaRelativePath,
          thumbnailRelativePath: variant.mediaThumbnailRelativePath,
        }) ?? coverMediaUrlByProductId.get(variant.productId) ?? null,
      isActive: variant.isActive,
      optionValues: variant.optionValues,
      price: variant.price,
      productId: variant.productId,
      productSlug: variant.productSlug,
      productStatus: variant.productStatus,
      productTitle: variant.productTitle,
      selectable: availability.selectable,
      sku: variant.sku,
      status: variant.status,
      stockOnHand: variant.stockOnHand,
      title: variant.title,
      unavailableReason: availability.unavailableReason,
    });
    variantsByProductId.set(variant.productId, variants);
  }

  const campaignById = new Map<string, AdminSaleCampaign>();

  for (const campaign of activeCampaignHeaderResult.rows) {
    campaignById.set(campaign.id, {
      badgeColor: campaign.badgeColor.toUpperCase(),
      badgeIcon: campaign.badgeIcon,
      badgeText: campaign.badgeText,
      ctaLabel: campaign.ctaLabel,
      createdAt: campaign.createdAt.toISOString(),
      discountPercent: campaign.discountPercent,
      headerPriority: campaign.headerPriority,
      headerVisible: campaign.headerVisible,
      id: campaign.id,
      name: campaign.name,
      publicHeadline: campaign.publicHeadline,
      status: "active",
      variants: [],
    });
  }

  for (const row of activeSaleRows) {
    const campaign = campaignById.get(row.campaignId) ?? {
      badgeColor: row.badgeColor.toUpperCase(),
      badgeIcon: row.badgeIcon,
      badgeText: row.badgeText,
      ctaLabel: row.ctaLabel,
      createdAt: row.createdAt.toISOString(),
      discountPercent: row.discountPercent,
      headerPriority: row.headerPriority,
      headerVisible: row.headerVisible,
      id: row.campaignId,
      name: row.campaignName,
      publicHeadline: row.publicHeadline,
      status: "active" as const,
      variants: [],
    };

    campaign.variants.push({
      originalCompareAtPrice: row.originalCompareAtPrice,
      originalPrice: row.originalPrice,
      productId: row.productId,
      productSlug: row.productSlug,
      productTitle: row.productTitle,
      salePrice: row.salePrice,
      sku: row.sku,
      title: row.title,
      variantId: row.variantId,
    });
    campaignById.set(row.campaignId, campaign);
  }

  return {
    activeCampaigns: Array.from(campaignById.values()),
    products: productRows.flatMap((product) => {
      const variants = variantsByProductId.get(product.id) ?? [];

      return variants.length > 0
        ? [
            {
              brandId: product.brandId,
              brandName: product.brandName,
              categoryId: product.categoryId,
              categoryPath: product.categoryPath,
              coverMediaUrl:
                coverMediaUrlByProductId.get(product.id) ??
                variants.find((variant) => variant.imageUrl)?.imageUrl ??
                null,
              id: product.id,
              slug: product.slug,
              status: product.status,
              title: product.title,
              variants,
            },
          ]
        : [];
    }),
    publicSaleUrl: createMarketplaceCanonicalUrl("/sale"),
    salesAvailable: activeSaleResult.ok && activeCampaignHeaderResult.ok,
    salesUnavailableMessage:
      activeSaleResult.ok && activeCampaignHeaderResult.ok
        ? null
        : activeSaleResult.ok
          ? (activeCampaignHeaderResult.message ??
            "Active sale campaigns could not be loaded.")
          : (activeSaleResult.message ?? "Active sale pricing could not be loaded."),
  };
}

export async function createSaleCampaign(input: unknown): Promise<SaleActionResult> {
  const parsed = createSaleCampaignSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the sale details.",
    };
  }

  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "You do not have permission to manage product sales.",
    };
  }

  const variantIds = Array.from(new Set(parsed.data.variantIds));

  const selectedVariants = await db
    .select({
      compareAtPrice: productVariants.compareAtPrice,
      costPrice: productVariants.costPrice,
      id: productVariants.id,
      isActive: productVariants.isActive,
      price: productVariants.price,
      productId: productVariants.productId,
      productSlug: products.slug,
      productStatus: products.status,
      productTitle: products.title,
      sku: productVariants.sku,
      status: productVariants.status,
      stockOnHand: productVariants.stockOnHand,
      title: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds));

  if (selectedVariants.length !== variantIds.length) {
    return {
      ok: false,
      message: "One or more selected variants no longer exist.",
    };
  }

  const activeSaleResult = await getActiveSaleRows(variantIds);

  if (!activeSaleResult.ok) {
    return {
      ok: false,
      message: activeSaleResult.message,
    };
  }

  const activeSaleRows = activeSaleResult.rows;
  const activeSaleByVariantId = new Map(
    activeSaleRows.map((row) => [row.variantId, row]),
  );
  const blockedVariant = selectedVariants.find(
    (variant) => !getSaleAvailability(variant, activeSaleByVariantId).selectable,
  );

  if (blockedVariant) {
    return {
      ok: false,
      message:
        getSaleAvailability(blockedVariant, activeSaleByVariantId)
          .unavailableReason ?? `${blockedVariant.title} cannot be put on sale.`,
    };
  }

  const now = new Date();
  const discountPercent = parsed.data.discountPercent;
  const saleRows = selectedVariants.map((variant) => {
    const price = toNumber(variant.price);

    if (price === null || price <= 0) {
      throw new Error(`Invalid price for ${variant.title}`);
    }

    return {
      originalCompareAtPrice: variant.compareAtPrice,
      originalPrice: variant.price,
      productId: variant.productId,
      productSlug: variant.productSlug,
      salePrice: getDiscountedPrice(price, discountPercent),
      variantId: variant.id,
    };
  });

  try {
    await db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(saleCampaigns)
        .values({
          badgeColor: parsed.data.badgeColor,
          badgeIcon: parsed.data.badgeIcon,
          badgeText: parsed.data.badgeText,
          ctaLabel: parsed.data.ctaLabel,
          createdAt: now,
          createdByUserId: access.session.user.id,
          discountPercent: toMoney(discountPercent),
          headerPriority: parsed.data.headerPriority,
          headerVisible: parsed.data.headerVisible,
          name: parsed.data.name,
          publicHeadline: parsed.data.publicHeadline,
          updatedAt: now,
        })
        .returning({ id: saleCampaigns.id });

      if (!campaign) {
        throw new Error("Sale campaign could not be created.");
      }

      await tx.insert(saleCampaignVariants).values(
        saleRows.map((row) => ({
          campaignId: campaign.id,
          createdAt: now,
          originalCompareAtPrice: row.originalCompareAtPrice,
          originalPrice: row.originalPrice,
          salePrice: row.salePrice,
          updatedAt: now,
          variantId: row.variantId,
        })),
      );

      for (const row of saleRows) {
        await tx
          .update(productVariants)
          .set({
            compareAtPrice: row.originalPrice,
            price: row.salePrice,
          })
          .where(eq(productVariants.id, row.variantId));
      }

      for (const productId of new Set(saleRows.map((row) => row.productId))) {
        await tx
          .update(products)
          .set({ updatedAt: now })
          .where(eq(products.id, productId));
      }

      await tx.insert(auditLogs).values({
        action: "sale_campaign.created",
        actorUserId: access.session.user.id,
        entityId: campaign.id,
        entityType: "sale_campaign",
        metadata: JSON.stringify({
          badgeColor: parsed.data.badgeColor,
          badgeIcon: parsed.data.badgeIcon,
          badgeText: parsed.data.badgeText,
          ctaLabel: parsed.data.ctaLabel,
          discountPercent,
          headerPriority: parsed.data.headerPriority,
          headerVisible: parsed.data.headerVisible,
          name: parsed.data.name,
          publicHeadline: parsed.data.publicHeadline,
          variantIds,
        }),
      });
    });
  } catch (error: unknown) {
    console.error("Failed to create sale campaign:", error);

    return {
      ok: false,
      message: getFriendlySalesErrorMessage("create", error),
    };
  }

  revalidateSalePaths(saleRows.map((row) => row.productSlug));

  return {
    ok: true,
    message: `Sale created for ${saleRows.length} variant${
      saleRows.length === 1 ? "" : "s"
    }.`,
  };
}

export async function updateSaleCampaignAppearance(
  input: unknown,
): Promise<SaleActionResult> {
  const parsed = updateSaleCampaignAppearanceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the campaign appearance.",
    };
  }

  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "You do not have permission to manage product sales.",
    };
  }

  const activeSaleResult = await getActiveSaleRows(
    undefined,
    parsed.data.campaignId,
  );

  if (!activeSaleResult.ok) {
    return {
      ok: false,
      message: activeSaleResult.message,
    };
  }

  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const [currentCampaign] = await tx
        .select({
          badgeColor: saleCampaigns.badgeColor,
          badgeIcon: saleCampaigns.badgeIcon,
          ctaLabel: saleCampaigns.ctaLabel,
          headerPriority: saleCampaigns.headerPriority,
          headerVisible: saleCampaigns.headerVisible,
          publicHeadline: saleCampaigns.publicHeadline,
        })
        .from(saleCampaigns)
        .where(
          and(
            eq(saleCampaigns.id, parsed.data.campaignId),
            eq(saleCampaigns.status, "active" as const),
          ),
        )
        .limit(1);

      if (!currentCampaign) {
        throw new Error("This sale campaign is not active.");
      }

      const nextAppearance = {
        badgeColor: parsed.data.badgeColor,
        badgeIcon: parsed.data.badgeIcon,
        ctaLabel: parsed.data.ctaLabel,
        headerPriority: parsed.data.headerPriority,
        headerVisible: parsed.data.headerVisible,
        publicHeadline: parsed.data.publicHeadline,
      };

      const [updatedCampaign] = await tx
        .update(saleCampaigns)
        .set({
          ...nextAppearance,
          updatedAt: now,
        })
        .where(
          and(
            eq(saleCampaigns.id, parsed.data.campaignId),
            eq(saleCampaigns.status, "active" as const),
          ),
        )
        .returning({ id: saleCampaigns.id });

      if (!updatedCampaign) {
        throw new Error("This sale campaign is not active.");
      }

      await tx.insert(auditLogs).values({
        action: "sale_campaign.appearance_updated",
        actorUserId: access.session.user.id,
        entityId: parsed.data.campaignId,
        entityType: "sale_campaign",
        metadata: JSON.stringify({
          next: nextAppearance,
          previous: currentCampaign,
        }),
      });
    });
  } catch (error: unknown) {
    console.error("Failed to update sale campaign appearance:", error);

    return {
      ok: false,
      message: getFriendlySalesErrorMessage("read", error).replace(
        "read sale campaign",
        "update sale campaign",
      ),
    };
  }

  revalidateSalePaths(
    activeSaleResult.rows.map((row) => row.productSlug),
  );

  return {
    ok: true,
    message: "Campaign appearance updated.",
  };
}

export async function endSaleCampaign(input: unknown): Promise<SaleActionResult> {
  const parsed = saleCampaignIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid sale campaign.",
    };
  }

  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "You do not have permission to manage product sales.",
    };
  }

  const [activeSaleResult, activeCampaignHeaderResult] = await Promise.all([
    getActiveSaleRows(undefined, parsed.data.campaignId),
    getActiveSaleCampaignHeaders(parsed.data.campaignId),
  ]);

  if (!activeSaleResult.ok || !activeCampaignHeaderResult.ok) {
    return {
      ok: false,
      message: activeSaleResult.ok
        ? activeCampaignHeaderResult.message
        : activeSaleResult.message,
    };
  }

  const campaignRows = activeSaleResult.rows;

  if (activeCampaignHeaderResult.rows.length === 0) {
    return {
      ok: false,
      message: "This sale campaign is not active.",
    };
  }

  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      for (const row of campaignRows) {
        await tx
          .update(productVariants)
          .set({
            compareAtPrice: row.originalCompareAtPrice,
            price: row.originalPrice,
          })
          .where(eq(productVariants.id, row.variantId));
      }

      await tx
        .update(saleCampaignVariants)
        .set({
          endedAt: now,
          status: "ended",
          updatedAt: now,
        })
        .where(
          and(
            eq(saleCampaignVariants.campaignId, parsed.data.campaignId),
            eq(saleCampaignVariants.status, "active"),
          ),
        );

      const [endedCampaign] = await tx
        .update(saleCampaigns)
        .set({
          endedAt: now,
          status: "ended",
          updatedAt: now,
        })
        .where(
          and(
            eq(saleCampaigns.id, parsed.data.campaignId),
            eq(saleCampaigns.status, "active" as const),
          ),
        )
        .returning({ id: saleCampaigns.id });

      if (!endedCampaign) {
        throw new Error("This sale campaign is not active.");
      }

      const affectedProductRows =
        campaignRows.length > 0
          ? await tx
              .select({ productId: productVariants.productId })
              .from(productVariants)
              .where(
                inArray(
                  productVariants.id,
                  campaignRows.map((row) => row.variantId),
                ),
              )
          : [];

      for (const productId of new Set(
        affectedProductRows.map((row) => row.productId),
      )) {
        await tx
          .update(products)
          .set({ updatedAt: now })
          .where(eq(products.id, productId));
      }

      await tx.insert(auditLogs).values({
        action: "sale_campaign.ended",
        actorUserId: access.session.user.id,
        entityId: parsed.data.campaignId,
        entityType: "sale_campaign",
        metadata: JSON.stringify({
          variantIds: campaignRows.map((row) => row.variantId),
        }),
      });
    });
  } catch (error: unknown) {
    console.error("Failed to end sale campaign:", error);

    return {
      ok: false,
      message: getFriendlySalesErrorMessage("end", error),
    };
  }

  revalidateSalePaths(campaignRows.map((row) => row.productSlug));

  return {
    ok: true,
    message: "Sale ended and variant prices restored.",
  };
}

export async function deleteSaleCampaign(input: unknown): Promise<SaleActionResult> {
  const parsed = saleCampaignIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid sale campaign.",
    };
  }

  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "You do not have permission to manage product sales.",
    };
  }

  const activeSaleResult = await getActiveSaleRows(
    undefined,
    parsed.data.campaignId,
  );

  if (!activeSaleResult.ok) {
    return {
      ok: false,
      message: activeSaleResult.message,
    };
  }

  const activeRows = activeSaleResult.rows;
  const now = new Date();
  let restoredVariantIds: string[] = [];

  try {
    await db.transaction(async (tx) => {
      const [claimedActiveCampaign] = await tx
        .update(saleCampaigns)
        .set({
          endedAt: now,
          status: "ended",
          updatedAt: now,
        })
        .where(
          and(
            eq(saleCampaigns.id, parsed.data.campaignId),
            eq(saleCampaigns.status, "active" as const),
          ),
        )
        .returning({ id: saleCampaigns.id });

      if (claimedActiveCampaign) {
        for (const row of activeRows) {
          await tx
            .update(productVariants)
            .set({
              compareAtPrice: row.originalCompareAtPrice,
              price: row.originalPrice,
            })
            .where(eq(productVariants.id, row.variantId));
        }

        restoredVariantIds = activeRows.map((row) => row.variantId);
      }

      if (restoredVariantIds.length > 0) {
        const affectedProductRows = await tx
          .select({ productId: productVariants.productId })
          .from(productVariants)
          .where(
            inArray(
              productVariants.id,
              restoredVariantIds,
            ),
          );

        for (const productId of new Set(
          affectedProductRows.map((row) => row.productId),
        )) {
          await tx
            .update(products)
            .set({ updatedAt: now })
            .where(eq(products.id, productId));
        }
      }

      const [deletedCampaign] = await tx
        .delete(saleCampaigns)
        .where(eq(saleCampaigns.id, parsed.data.campaignId))
        .returning({ id: saleCampaigns.id });

      if (!deletedCampaign) {
        throw new Error("Sale campaign was not found");
      }

      await tx.insert(auditLogs).values({
        action: "sale_campaign.deleted",
        actorUserId: access.session.user.id,
        entityId: parsed.data.campaignId,
        entityType: "sale_campaign",
        metadata: JSON.stringify({
          restoredActiveVariants: restoredVariantIds,
        }),
      });
    });
  } catch (error: unknown) {
    console.error("Failed to delete sale campaign:", error);

    return {
      ok: false,
      message: getFriendlySalesErrorMessage("delete", error),
    };
  }

  revalidateSalePaths(activeRows.map((row) => row.productSlug));

  return {
    ok: true,
    message:
      restoredVariantIds.length > 0
        ? "Sale deleted and variant prices restored."
        : "Sale deleted.",
  };
}
