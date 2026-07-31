import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  productReviewSummaries,
  reviews,
  type ProductReviewStatus,
} from "@/src/db/schema";

export type ProductRatingSummary = {
  averageRating: number | null;
  ratingCount1: number;
  ratingCount2: number;
  ratingCount3: number;
  ratingCount4: number;
  ratingCount5: number;
  reviewCount: number;
};

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ProductReviewDatabase = typeof db | DatabaseTransaction;

const emptySummary: ProductRatingSummary = {
  averageRating: null,
  ratingCount1: 0,
  ratingCount2: 0,
  ratingCount3: 0,
  ratingCount4: 0,
  ratingCount5: 0,
  reviewCount: 0,
};

function toCount(value: unknown) {
  const count = Number(value ?? 0);

  return Number.isFinite(count) ? count : 0;
}

function toAverage(value: unknown, reviewCount: number) {
  if (reviewCount <= 0) {
    return null;
  }

  const average = Number(value ?? 0);

  return Number.isFinite(average) && average > 0 ? average : null;
}

export function formatRatingValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function getEmptyProductRatingSummary(): ProductRatingSummary {
  return { ...emptySummary };
}

export async function getProductRatingSummariesByProductId(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, ProductRatingSummary>();
  }

  const rows = await db
    .select()
    .from(productReviewSummaries)
    .where(inArray(productReviewSummaries.productId, productIds));

  return new Map(
    rows.map((row) => {
      const reviewCount = toCount(row.reviewCount);

      return [
        row.productId,
        {
          averageRating: toAverage(row.averageRating, reviewCount),
          ratingCount1: toCount(row.ratingCount1),
          ratingCount2: toCount(row.ratingCount2),
          ratingCount3: toCount(row.ratingCount3),
          ratingCount4: toCount(row.ratingCount4),
          ratingCount5: toCount(row.ratingCount5),
          reviewCount,
        },
      ] as const;
    }),
  );
}

export async function recalculateProductRatingSummary(
  productId: string,
  transaction: ProductReviewDatabase = db,
) {
  const [summary] = await transaction
    .select({
      averageRating: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)::text`,
      ratingCount1: sql<number>`count(*) filter (where ${reviews.rating} = 1)::int`,
      ratingCount2: sql<number>`count(*) filter (where ${reviews.rating} = 2)::int`,
      ratingCount3: sql<number>`count(*) filter (where ${reviews.rating} = 3)::int`,
      ratingCount4: sql<number>`count(*) filter (where ${reviews.rating} = 4)::int`,
      ratingCount5: sql<number>`count(*) filter (where ${reviews.rating} = 5)::int`,
      reviewCount: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.status, "approved" satisfies ProductReviewStatus),
      ),
    );

  const next = {
    averageRating: summary?.averageRating ?? "0",
    ratingCount1: toCount(summary?.ratingCount1),
    ratingCount2: toCount(summary?.ratingCount2),
    ratingCount3: toCount(summary?.ratingCount3),
    ratingCount4: toCount(summary?.ratingCount4),
    ratingCount5: toCount(summary?.ratingCount5),
    reviewCount: toCount(summary?.reviewCount),
    updatedAt: new Date(),
  };

  await transaction
    .insert(productReviewSummaries)
    .values({
      productId,
      ...next,
    })
    .onConflictDoUpdate({
      target: productReviewSummaries.productId,
      set: next,
    });

  return {
    averageRating: toAverage(next.averageRating, next.reviewCount),
    ratingCount1: next.ratingCount1,
    ratingCount2: next.ratingCount2,
    ratingCount3: next.ratingCount3,
    ratingCount4: next.ratingCount4,
    ratingCount5: next.ratingCount5,
    reviewCount: next.reviewCount,
  } satisfies ProductRatingSummary;
}
