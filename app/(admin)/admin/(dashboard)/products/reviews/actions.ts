"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { auditLogs, products, reviews } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { recalculateProductRatingSummary } from "@/src/modules/reviews";

const reviewIdSchema = z.object({
  reviewId: z.string().uuid(),
});

const rejectReviewSchema = reviewIdSchema.extend({
  reason: z
    .string()
    .trim()
    .max(1000, "Keep the moderation note under 1,000 characters.")
    .optional()
    .transform((value) => value || "Review did not meet product review guidelines."),
});

async function requireReviewModerationAccess() {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to moderate product reviews.");
  }

  return access.session;
}

async function getModeratedReview(reviewId: string) {
  const [review] = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productSlug: products.slug,
      productTitle: products.title,
      rating: reviews.rating,
      status: reviews.status,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  return review;
}

async function revalidateReviewSurfaces(productSlug: string) {
  revalidatePath("/products/reviews");
  revalidatePath("/products");
  revalidatePath(`/products/${productSlug}`);
}

export async function approveCustomerProductReview(formData: FormData) {
  const session = await requireReviewModerationAccess();
  const parsed = reviewIdSchema.safeParse({
    reviewId: formData.get("reviewId"),
  });

  if (!parsed.success) {
    throw new Error("Review was not found.");
  }

  const review = await getModeratedReview(parsed.data.reviewId);

  if (!review) {
    throw new Error("Review was not found.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({
        approvedAt: now,
        hiddenAt: null,
        moderatedByUserId: session.user.id,
        rejectedAt: null,
        rejectedReason: null,
        status: "approved",
        updatedAt: now,
      })
      .where(eq(reviews.id, review.id));

    await recalculateProductRatingSummary(review.productId, tx);

    await tx.insert(auditLogs).values({
      action: "customer_product_review.approved",
      actorUserId: session.user.id,
      entityId: review.id,
      entityType: "review",
      metadata: JSON.stringify({
        productId: review.productId,
        productTitle: review.productTitle,
        rating: review.rating,
        statusBefore: review.status,
      }),
    });
  });

  await revalidateReviewSurfaces(review.productSlug);
}

export async function rejectCustomerProductReview(formData: FormData) {
  const session = await requireReviewModerationAccess();
  const parsed = rejectReviewSchema.safeParse({
    reason: formData.get("reason"),
    reviewId: formData.get("reviewId"),
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Review could not be rejected.",
    );
  }

  const review = await getModeratedReview(parsed.data.reviewId);

  if (!review) {
    throw new Error("Review was not found.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({
        hiddenAt: null,
        moderatedByUserId: session.user.id,
        rejectedAt: now,
        rejectedReason: parsed.data.reason,
        status: "rejected",
        updatedAt: now,
      })
      .where(eq(reviews.id, review.id));

    await recalculateProductRatingSummary(review.productId, tx);

    await tx.insert(auditLogs).values({
      action: "customer_product_review.rejected",
      actorUserId: session.user.id,
      entityId: review.id,
      entityType: "review",
      metadata: JSON.stringify({
        productId: review.productId,
        productTitle: review.productTitle,
        reason: parsed.data.reason,
        rating: review.rating,
        statusBefore: review.status,
      }),
    });
  });

  await revalidateReviewSurfaces(review.productSlug);
}

export async function hideCustomerProductReview(formData: FormData) {
  const session = await requireReviewModerationAccess();
  const parsed = reviewIdSchema.safeParse({
    reviewId: formData.get("reviewId"),
  });

  if (!parsed.success) {
    throw new Error("Review was not found.");
  }

  const review = await getModeratedReview(parsed.data.reviewId);

  if (!review) {
    throw new Error("Review was not found.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({
        hiddenAt: now,
        moderatedByUserId: session.user.id,
        status: "hidden",
        updatedAt: now,
      })
      .where(eq(reviews.id, review.id));

    await recalculateProductRatingSummary(review.productId, tx);

    await tx.insert(auditLogs).values({
      action: "customer_product_review.hidden",
      actorUserId: session.user.id,
      entityId: review.id,
      entityType: "review",
      metadata: JSON.stringify({
        productId: review.productId,
        productTitle: review.productTitle,
        rating: review.rating,
        statusBefore: review.status,
      }),
    });
  });

  await revalidateReviewSurfaces(review.productSlug);
}
