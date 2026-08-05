import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  brands,
  categories,
  productVariants,
  products,
  saleCampaigns,
  saleCampaignVariants,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

const createSaleCampaignSchema = z.object({
  badgeText: z.string().trim().min(1).max(80).default("Sale"),
  discountPercent: z.coerce.number().min(1).max(95),
  name: z.string().trim().min(1).max(160),
  variantIds: z.array(z.string().uuid()).min(1).max(200),
});

const saleCampaignIdSchema = z.object({
  campaignId: z.string().uuid(),
});

export type SaleActionResult = {
  message?: string;
  ok: boolean;
};

export type AdminSaleVariant = {
  activeCampaignId: string | null;
  activeCampaignName: string | null;
  compareAtPrice: string | null;
  costPrice: string | null;
  id: string;
  isActive: boolean;
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
  brandName: string | null;
  categoryPath: string | null;
  id: string;
  slug: string;
  status: string;
  title: string;
  variants: AdminSaleVariant[];
};

export type AdminSaleCampaignVariant = {
  originalCompareAtPrice: string | null;
  originalPrice: string;
  productSlug: string;
  productTitle: string;
  salePrice: string;
  sku: string;
  title: string;
  variantId: string;
};

export type AdminSaleCampaign = {
  badgeText: string;
  createdAt: string;
  discountPercent: string;
  id: string;
  name: string;
  status: "active" | "ended";
  variants: AdminSaleCampaignVariant[];
};

export type AdminSalesData = {
  activeCampaigns: AdminSaleCampaign[];
  products: AdminSaleProduct[];
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
  badgeText: string;
  campaignId: string;
  campaignName: string;
  createdAt: Date;
  discountPercent: string;
  originalCompareAtPrice: string | null;
  originalPrice: string;
  productSlug: string;
  productTitle: string;
  salePrice: string;
  sku: string;
  title: string;
  variantId: string;
};

const publicProductStatuses = new Set(["active", "live"]);

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
) {
  const activeSale = activeSaleByVariantId.get(variant.id);

  if (activeSale) {
    return {
      selectable: false,
      unavailableReason: `Already on ${activeSale.campaignName}.`,
    };
  }

  if (!publicProductStatuses.has(variant.productStatus)) {
    return {
      selectable: false,
      unavailableReason: "Product is not active.",
    };
  }

  if (variant.status !== "active" || !variant.isActive) {
    return {
      selectable: false,
      unavailableReason: "Variant is not active.",
    };
  }

  const price = toNumber(variant.price);

  if (price === null || price <= 0) {
    return {
      selectable: false,
      unavailableReason: "Variant has no valid price.",
    };
  }

  if (variantHasCompareAtSale(variant)) {
    return {
      selectable: false,
      unavailableReason: "Already has compare-at sale pricing.",
    };
  }

  return {
    selectable: true,
    unavailableReason: null,
  };
}

async function getActiveSaleRows(variantIds?: string[]) {
  if (variantIds && variantIds.length === 0) {
    return [];
  }

  const baseFilters = [
    eq(saleCampaigns.status, "active" as const),
    eq(saleCampaignVariants.status, "active" as const),
  ];
  const whereCondition = variantIds
    ? and(...baseFilters, inArray(saleCampaignVariants.variantId, variantIds))
    : and(...baseFilters);

  return db
    .select({
      badgeText: saleCampaigns.badgeText,
      campaignId: saleCampaigns.id,
      campaignName: saleCampaigns.name,
      createdAt: saleCampaigns.createdAt,
      discountPercent: saleCampaigns.discountPercent,
      originalCompareAtPrice: saleCampaignVariants.originalCompareAtPrice,
      originalPrice: saleCampaignVariants.originalPrice,
      productSlug: products.slug,
      productTitle: products.title,
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
    .orderBy(desc(saleCampaigns.createdAt), asc(products.title), asc(productVariants.title));
}

function revalidateSalePaths(productSlugs: Iterable<string>) {
  revalidatePath("/");
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
    };
  }

  const [productRows, variantRows, activeSaleRows] = await Promise.all([
    db
      .select({
        brandName: brands.name,
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
      .orderBy(asc(products.title), asc(productVariants.title)),
    getActiveSaleRows(),
  ]);

  const activeSaleByVariantId = new Map(
    activeSaleRows.map((row) => [row.variantId, row]),
  );
  const variantsByProductId = new Map<string, AdminSaleVariant[]>();

  for (const variant of variantRows) {
    const activeSale = activeSaleByVariantId.get(variant.id) ?? null;
    const availability = getSaleAvailability(variant, activeSaleByVariantId);
    const variants = variantsByProductId.get(variant.productId) ?? [];

    variants.push({
      activeCampaignId: activeSale?.campaignId ?? null,
      activeCampaignName: activeSale?.campaignName ?? null,
      compareAtPrice: variant.compareAtPrice,
      costPrice: variant.costPrice,
      id: variant.id,
      isActive: variant.isActive,
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

  for (const row of activeSaleRows) {
    const campaign = campaignById.get(row.campaignId) ?? {
      badgeText: row.badgeText,
      createdAt: row.createdAt.toISOString(),
      discountPercent: row.discountPercent,
      id: row.campaignId,
      name: row.campaignName,
      status: "active" as const,
      variants: [],
    };

    campaign.variants.push({
      originalCompareAtPrice: row.originalCompareAtPrice,
      originalPrice: row.originalPrice,
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
    products: productRows.map((product) => ({
      brandName: product.brandName,
      categoryPath: product.categoryPath,
      id: product.id,
      slug: product.slug,
      status: product.status,
      title: product.title,
      variants: variantsByProductId.get(product.id) ?? [],
    })),
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

  const activeSaleRows = await getActiveSaleRows(variantIds);
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

  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(saleCampaigns)
      .values({
        badgeText: parsed.data.badgeText,
        createdAt: now,
        createdByUserId: access.session.user.id,
        discountPercent: toMoney(discountPercent),
        name: parsed.data.name,
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
        badgeText: parsed.data.badgeText,
        discountPercent,
        name: parsed.data.name,
        variantIds,
      }),
    });
  });

  revalidateSalePaths(saleRows.map((row) => row.productSlug));

  return {
    ok: true,
    message: `Sale created for ${saleRows.length} variant${
      saleRows.length === 1 ? "" : "s"
    }.`,
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

  const saleRows = await getActiveSaleRows();
  const campaignRows = saleRows.filter(
    (row) => row.campaignId === parsed.data.campaignId,
  );

  if (campaignRows.length === 0) {
    return {
      ok: false,
      message: "This sale campaign is not active.",
    };
  }

  const now = new Date();

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

    await tx
      .update(saleCampaigns)
      .set({
        endedAt: now,
        status: "ended",
        updatedAt: now,
      })
      .where(eq(saleCampaigns.id, parsed.data.campaignId));

    const affectedProductRows = await tx
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(inArray(productVariants.id, campaignRows.map((row) => row.variantId)));

    for (const productId of new Set(affectedProductRows.map((row) => row.productId))) {
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

  const activeRows = (await getActiveSaleRows()).filter(
    (row) => row.campaignId === parsed.data.campaignId,
  );
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const row of activeRows) {
      await tx
        .update(productVariants)
        .set({
          compareAtPrice: row.originalCompareAtPrice,
          price: row.originalPrice,
        })
        .where(eq(productVariants.id, row.variantId));
    }

    if (activeRows.length > 0) {
      const affectedProductRows = await tx
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(inArray(productVariants.id, activeRows.map((row) => row.variantId)));

      for (const productId of new Set(affectedProductRows.map((row) => row.productId))) {
        await tx
          .update(products)
          .set({ updatedAt: now })
          .where(eq(products.id, productId));
      }
    }

    await tx
      .delete(saleCampaigns)
      .where(eq(saleCampaigns.id, parsed.data.campaignId));

    await tx.insert(auditLogs).values({
      action: "sale_campaign.deleted",
      actorUserId: access.session.user.id,
      entityId: parsed.data.campaignId,
      entityType: "sale_campaign",
      metadata: JSON.stringify({
        restoredActiveVariants: activeRows.map((row) => row.variantId),
      }),
    });
  });

  revalidateSalePaths(activeRows.map((row) => row.productSlug));

  return {
    ok: true,
    message:
      activeRows.length > 0
        ? "Sale deleted and variant prices restored."
        : "Sale deleted.",
  };
}
