import "server-only";

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/src/db";
import {
  auditLogs,
  productVariants,
  products,
  saleCampaigns,
  saleCampaignVariants,
} from "@/src/db/schema";
import { getDiscountedSalePrice } from "@/src/modules/sales/scheduling";

type SaleLifecycleReason =
  | "admin_cancelled"
  | "admin_ended"
  | "admin_started"
  | "automatic_expiry"
  | "scheduled_start";

export type SaleLifecycleTransitionResult = {
  campaignId: string;
  outcome:
    | "activated"
    | "already_active"
    | "already_ended"
    | "cancelled"
    | "ended"
    | "expired_before_activation"
    | "not_due";
  productSlugs: string[];
  variantIds: string[];
};

export type SaleLifecycleBatchFailure = {
  campaignId: string;
  message: string;
  phase: "expiry" | "start";
};

export type SaleLifecycleBatchResult = {
  activated: number;
  ended: number;
  failures: SaleLifecycleBatchFailure[];
  skipped: number;
};

export class SaleLifecycleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleLifecycleConflictError";
  }
}

export class SaleCampaignNotFoundError extends Error {
  constructor() {
    super("Sale campaign was not found.");
    this.name = "SaleCampaignNotFoundError";
  }
}

function toNumber(value: string | null | undefined) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

async function acquireCampaignLock(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  campaignId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`sale-campaign:${campaignId}`}))`,
  );
}

async function acquireVariantLocks(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  variantIds: readonly string[],
) {
  for (const variantId of [...new Set(variantIds)].sort()) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`sale-variant:${variantId}`}))`,
    );
  }

  if (variantIds.length > 0) {
    await transaction
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(inArray(productVariants.id, [...new Set(variantIds)]))
      .orderBy(productVariants.id)
      .for("update");
  }
}

async function markScheduledActivationFailed({
  campaignId,
  message,
  now,
}: {
  campaignId: string;
  message: string;
  now: Date;
}) {
  return db.transaction(async (transaction) => {
    await acquireCampaignLock(transaction, campaignId);

    const [campaign] = await transaction
      .select({
        startsAt: saleCampaigns.startsAt,
        status: saleCampaigns.status,
      })
      .from(saleCampaigns)
      .where(eq(saleCampaigns.id, campaignId))
      .limit(1);

    if (
      !campaign ||
      campaign.status !== "scheduled" ||
      campaign.startsAt.getTime() > now.getTime()
    ) {
      return false;
    }

    const variantRows = await transaction
      .select({ variantId: saleCampaignVariants.variantId })
      .from(saleCampaignVariants)
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "scheduled"),
        ),
      );
    const variantIds = variantRows.map((row) => row.variantId);

    await transaction
      .update(saleCampaignVariants)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "scheduled"),
        ),
      );
    const [failedCampaign] = await transaction
      .update(saleCampaigns)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaigns.id, campaignId),
          eq(saleCampaigns.status, "scheduled"),
        ),
      )
      .returning({ id: saleCampaigns.id });

    if (!failedCampaign) {
      throw new SaleLifecycleConflictError(
        "Scheduled sale changed before its activation failure could be recorded.",
      );
    }
    await transaction.insert(auditLogs).values({
      action: "sale_campaign.activation_failed",
      actorUserId: null,
      entityId: campaignId,
      entityType: "sale_campaign",
      metadata: JSON.stringify({ message, variantIds }),
    });

    return true;
  });
}

export async function activateSaleCampaign({
  actorUserId = null,
  campaignId,
  forceStartNow = false,
  now = new Date(),
  reason = forceStartNow ? "admin_started" : "scheduled_start",
}: {
  actorUserId?: string | null;
  campaignId: string;
  forceStartNow?: boolean;
  now?: Date;
  reason?: Extract<SaleLifecycleReason, "admin_started" | "scheduled_start">;
}): Promise<SaleLifecycleTransitionResult> {
  const result = await db.transaction(async (transaction) => {
    await acquireCampaignLock(transaction, campaignId);

    const [campaign] = await transaction
      .select({
        discountPercent: saleCampaigns.discountPercent,
        endsAt: saleCampaigns.endsAt,
        startsAt: saleCampaigns.startsAt,
        status: saleCampaigns.status,
      })
      .from(saleCampaigns)
      .where(eq(saleCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      throw new SaleCampaignNotFoundError();
    }

    if (campaign.status === "active") {
      return {
        campaignId,
        outcome: "already_active" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    if (campaign.status === "ended") {
      return {
        campaignId,
        outcome: "already_ended" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    if (!forceStartNow && campaign.startsAt.getTime() > now.getTime()) {
      return {
        campaignId,
        outcome: "not_due" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    if (campaign.endsAt && campaign.endsAt.getTime() <= now.getTime()) {
      await transaction
        .update(saleCampaignVariants)
        .set({ endedAt: now, status: "ended", updatedAt: now })
        .where(
          and(
            eq(saleCampaignVariants.campaignId, campaignId),
            eq(saleCampaignVariants.status, "scheduled"),
          ),
        );
      await transaction
        .update(saleCampaigns)
        .set({ endedAt: now, status: "ended", updatedAt: now })
        .where(eq(saleCampaigns.id, campaignId));
      await transaction.insert(auditLogs).values({
        action: "sale_campaign.expired_before_activation",
        actorUserId,
        entityId: campaignId,
        entityType: "sale_campaign",
        metadata: JSON.stringify({ reason: "automatic_expiry" }),
      });

      return {
        campaignId,
        outcome: "expired_before_activation" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    const plannedRows = await transaction
      .select({ variantId: saleCampaignVariants.variantId })
      .from(saleCampaignVariants)
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "scheduled"),
        ),
      );
    const variantIds = plannedRows.map((row) => row.variantId);

    if (variantIds.length === 0) {
      throw new SaleLifecycleConflictError(
        "Scheduled sale has no variants available to activate.",
      );
    }

    await acquireVariantLocks(transaction, variantIds);

    const activationStartsAt = forceStartNow ? now : campaign.startsAt;
    const existingCampaignEndsAfterStart = or(
      isNull(saleCampaigns.endsAt),
      gt(saleCampaigns.endsAt, activationStartsAt),
    )!;
    const intervalsOverlap = campaign.endsAt
      ? and(
          existingCampaignEndsAfterStart,
          lt(saleCampaigns.startsAt, campaign.endsAt),
        )!
      : existingCampaignEndsAfterStart;
    const intervalFilters = [
      inArray(saleCampaignVariants.variantId, variantIds),
      ne(saleCampaignVariants.campaignId, campaignId),
      inArray(saleCampaignVariants.status, ["scheduled", "active"]),
      inArray(saleCampaigns.status, ["scheduled", "active"]),
      or(
        and(
          eq(saleCampaignVariants.status, "active"),
          eq(saleCampaigns.status, "active"),
        ),
        intervalsOverlap,
      )!,
    ];

    const overlappingRows = await transaction
      .select({ variantId: saleCampaignVariants.variantId })
      .from(saleCampaignVariants)
      .innerJoin(
        saleCampaigns,
        eq(saleCampaigns.id, saleCampaignVariants.campaignId),
      )
      .where(and(...intervalFilters))
      .limit(1);

    if (overlappingRows.length > 0) {
      throw new SaleLifecycleConflictError(
        "A selected variant overlaps another scheduled or active sale campaign.",
      );
    }

    const variantRows = await transaction
      .select({
        compareAtPrice: productVariants.compareAtPrice,
        isActive: productVariants.isActive,
        price: productVariants.price,
        productId: products.id,
        productSlug: products.slug,
        productStatus: products.status,
        status: productVariants.status,
        title: productVariants.title,
        variantId: productVariants.id,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds));

    if (variantRows.length !== variantIds.length) {
      throw new SaleLifecycleConflictError(
        "One or more scheduled variants no longer exist.",
      );
    }

    const discountPercent = Number(campaign.discountPercent);

    for (const variant of variantRows) {
      const price = toNumber(variant.price);
      const compareAtPrice = toNumber(variant.compareAtPrice);

      if (
        !["active", "live"].includes(variant.productStatus) ||
        variant.status !== "active" ||
        !variant.isActive ||
        price === null ||
        price <= 0
      ) {
        throw new SaleLifecycleConflictError(
          `${variant.title} is no longer eligible for a sale.`,
        );
      }

      if (compareAtPrice !== null && compareAtPrice > price) {
        throw new SaleLifecycleConflictError(
          `${variant.title} already has compare-at sale pricing.`,
        );
      }

      const salePrice = getDiscountedSalePrice(price, discountPercent);

      await transaction
        .update(saleCampaignVariants)
        .set({
          originalCompareAtPrice: variant.compareAtPrice,
          originalPrice: variant.price,
          salePrice,
          status: "active",
          updatedAt: now,
        })
        .where(
          and(
            eq(saleCampaignVariants.campaignId, campaignId),
            eq(saleCampaignVariants.variantId, variant.variantId),
            eq(saleCampaignVariants.status, "scheduled"),
          ),
        );
      await transaction
        .update(productVariants)
        .set({ compareAtPrice: variant.price, price: salePrice })
        .where(eq(productVariants.id, variant.variantId));
    }

    const startsAt = activationStartsAt;

    const [activatedCampaign] = await transaction
      .update(saleCampaigns)
      .set({
        activatedAt: now,
        startsAt,
        status: "active",
        updatedAt: now,
      })
      .where(
        and(
          eq(saleCampaigns.id, campaignId),
          eq(saleCampaigns.status, "scheduled"),
        ),
      )
      .returning({ id: saleCampaigns.id });

    if (!activatedCampaign) {
      throw new SaleLifecycleConflictError(
        "Scheduled sale changed before it could be activated.",
      );
    }

    const productIds = new Set(variantRows.map((row) => row.productId));

    for (const productId of productIds) {
      await transaction
        .update(products)
        .set({ updatedAt: now })
        .where(eq(products.id, productId));
    }

    await transaction.insert(auditLogs).values({
      action: "sale_campaign.activated",
      actorUserId,
      entityId: campaignId,
      entityType: "sale_campaign",
      metadata: JSON.stringify({
        activatedAt: now.toISOString(),
        reason,
        variantIds,
      }),
    });

    return {
      campaignId,
      outcome: "activated" as const,
      productSlugs: [...new Set(variantRows.map((row) => row.productSlug))],
      variantIds,
    };
  });

  return result;
}

export async function endActiveSaleCampaign({
  actorUserId = null,
  campaignId,
  now = new Date(),
  reason = "admin_ended",
}: {
  actorUserId?: string | null;
  campaignId: string;
  now?: Date;
  reason?: Extract<SaleLifecycleReason, "admin_ended" | "automatic_expiry">;
}): Promise<SaleLifecycleTransitionResult> {
  const result = await db.transaction(async (transaction) => {
    await acquireCampaignLock(transaction, campaignId);

    const [campaign] = await transaction
      .select({ status: saleCampaigns.status })
      .from(saleCampaigns)
      .where(eq(saleCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      throw new SaleCampaignNotFoundError();
    }

    if (campaign.status === "ended") {
      return {
        campaignId,
        outcome: "already_ended" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    if (campaign.status === "scheduled") {
      throw new SaleLifecycleConflictError(
        "Scheduled sales must be cancelled instead of ended.",
      );
    }

    const campaignVariantRows = await transaction
      .select({ variantId: saleCampaignVariants.variantId })
      .from(saleCampaignVariants)
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "active"),
        ),
      );
    const variantIds = campaignVariantRows.map((row) => row.variantId);

    await acquireVariantLocks(transaction, variantIds);

    const saleRows =
      variantIds.length > 0
        ? await transaction
            .select({
              originalCompareAtPrice:
                saleCampaignVariants.originalCompareAtPrice,
              originalPrice: saleCampaignVariants.originalPrice,
              productId: products.id,
              productSlug: products.slug,
              variantId: saleCampaignVariants.variantId,
            })
            .from(saleCampaignVariants)
            .innerJoin(
              productVariants,
              eq(productVariants.id, saleCampaignVariants.variantId),
            )
            .innerJoin(products, eq(products.id, productVariants.productId))
            .where(
              and(
                eq(saleCampaignVariants.campaignId, campaignId),
                eq(saleCampaignVariants.status, "active"),
              ),
            )
        : [];

    for (const row of saleRows) {
      await transaction
        .update(productVariants)
        .set({
          compareAtPrice: row.originalCompareAtPrice,
          price: row.originalPrice,
        })
        .where(eq(productVariants.id, row.variantId));
    }

    await transaction
      .update(saleCampaignVariants)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "active"),
        ),
      );
    const [endedCampaign] = await transaction
      .update(saleCampaigns)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaigns.id, campaignId),
          eq(saleCampaigns.status, "active"),
        ),
      )
      .returning({ id: saleCampaigns.id });

    if (!endedCampaign) {
      throw new SaleLifecycleConflictError(
        "Active sale changed before it could be ended.",
      );
    }

    for (const productId of new Set(saleRows.map((row) => row.productId))) {
      await transaction
        .update(products)
        .set({ updatedAt: now })
        .where(eq(products.id, productId));
    }

    await transaction.insert(auditLogs).values({
      action: "sale_campaign.ended",
      actorUserId,
      entityId: campaignId,
      entityType: "sale_campaign",
      metadata: JSON.stringify({ reason, variantIds }),
    });

    return {
      campaignId,
      outcome: "ended" as const,
      productSlugs: [...new Set(saleRows.map((row) => row.productSlug))],
      variantIds,
    };
  });

  return result;
}

export async function cancelScheduledSaleCampaignLifecycle({
  actorUserId = null,
  campaignId,
  now = new Date(),
  reason = "admin_cancelled",
}: {
  actorUserId?: string | null;
  campaignId: string;
  now?: Date;
  reason?: Extract<SaleLifecycleReason, "admin_cancelled" | "automatic_expiry">;
}): Promise<SaleLifecycleTransitionResult> {
  const result = await db.transaction(async (transaction) => {
    await acquireCampaignLock(transaction, campaignId);

    const [campaign] = await transaction
      .select({ status: saleCampaigns.status })
      .from(saleCampaigns)
      .where(eq(saleCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      throw new SaleCampaignNotFoundError();
    }

    if (campaign.status === "ended") {
      return {
        campaignId,
        outcome: "already_ended" as const,
        productSlugs: [],
        variantIds: [],
      };
    }

    if (campaign.status === "active") {
      throw new SaleLifecycleConflictError(
        "Active sales must be ended so their original prices are restored.",
      );
    }

    const variantRows = await transaction
      .select({ variantId: saleCampaignVariants.variantId })
      .from(saleCampaignVariants)
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "scheduled"),
        ),
      );
    const variantIds = variantRows.map((row) => row.variantId);

    await transaction
      .update(saleCampaignVariants)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaignVariants.campaignId, campaignId),
          eq(saleCampaignVariants.status, "scheduled"),
        ),
      );
    const [cancelledCampaign] = await transaction
      .update(saleCampaigns)
      .set({ endedAt: now, status: "ended", updatedAt: now })
      .where(
        and(
          eq(saleCampaigns.id, campaignId),
          eq(saleCampaigns.status, "scheduled"),
        ),
      )
      .returning({ id: saleCampaigns.id });

    if (!cancelledCampaign) {
      throw new SaleLifecycleConflictError(
        "Scheduled sale changed before it could be cancelled.",
      );
    }
    await transaction.insert(auditLogs).values({
      action:
        reason === "automatic_expiry"
          ? "sale_campaign.expired_before_activation"
          : "sale_campaign.cancelled",
      actorUserId,
      entityId: campaignId,
      entityType: "sale_campaign",
      metadata: JSON.stringify({ reason, variantIds }),
    });

    return {
      campaignId,
      outcome: "cancelled" as const,
      productSlugs: [],
      variantIds,
    };
  });

  return result;
}

export async function processSaleCampaignLifecycle({
  limit = 50,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}): Promise<SaleLifecycleBatchResult> {
  const result: SaleLifecycleBatchResult = {
    activated: 0,
    ended: 0,
    failures: [],
    skipped: 0,
  };
  const expiringCampaigns = await db
    .select({ id: saleCampaigns.id, status: saleCampaigns.status })
    .from(saleCampaigns)
    .where(
      and(
        or(
          eq(saleCampaigns.status, "active"),
          eq(saleCampaigns.status, "scheduled"),
        ),
        isNotNull(saleCampaigns.endsAt),
        lte(saleCampaigns.endsAt, now),
      ),
    )
    .orderBy(asc(saleCampaigns.endsAt), asc(saleCampaigns.id))
    .limit(limit);

  for (const campaign of expiringCampaigns) {
    try {
      const transition =
        campaign.status === "active"
          ? await endActiveSaleCampaign({
              campaignId: campaign.id,
              now,
              reason: "automatic_expiry",
            })
          : await cancelScheduledSaleCampaignLifecycle({
              campaignId: campaign.id,
              now,
              reason: "automatic_expiry",
            });

      if (transition.outcome === "ended" || transition.outcome === "cancelled") {
        result.ended += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error: unknown) {
      result.failures.push({
        campaignId: campaign.id,
        message: error instanceof Error ? error.message : "Unknown sale expiry error.",
        phase: "expiry",
      });
    }
  }

  const remainingDueExpirations = await db
    .select({ id: saleCampaigns.id })
    .from(saleCampaigns)
    .where(
      and(
        or(
          eq(saleCampaigns.status, "active"),
          eq(saleCampaigns.status, "scheduled"),
        ),
        isNotNull(saleCampaigns.endsAt),
        lte(saleCampaigns.endsAt, now),
      ),
    )
    .limit(1);

  // Drain every due expiry before starting any campaign. This preserves
  // exact-boundary handoffs even when the expiry set spans multiple batches.
  if (remainingDueExpirations.length > 0) {
    return result;
  }

  const startingCampaigns = await db
    .select({ id: saleCampaigns.id })
    .from(saleCampaigns)
    .where(
      and(
        eq(saleCampaigns.status, "scheduled"),
        lte(saleCampaigns.startsAt, now),
      ),
    )
    .orderBy(asc(saleCampaigns.startsAt), asc(saleCampaigns.id))
    .limit(limit);

  for (const campaign of startingCampaigns) {
    try {
      const transition = await activateSaleCampaign({
        campaignId: campaign.id,
        now,
        reason: "scheduled_start",
      });

      if (transition.outcome === "activated") {
        result.activated += 1;
      } else if (transition.outcome === "expired_before_activation") {
        result.ended += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown sale start error.";

      if (error instanceof SaleLifecycleConflictError) {
        try {
          if (
            await markScheduledActivationFailed({
              campaignId: campaign.id,
              message,
              now,
            })
          ) {
            result.ended += 1;
          }
        } catch (failureError: unknown) {
          console.error(
            "Failed to close a sale after its activation failed:",
            failureError,
          );
        }
      }

      result.failures.push({
        campaignId: campaign.id,
        message,
        phase: "start",
      });
    }
  }

  return result;
}
