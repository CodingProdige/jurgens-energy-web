"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  productReviewEvents,
  products,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type ProductReviewMutationState = {
  message?: string;
  ok?: boolean;
};

const productReviewSchema = z.object({
  productId: z.string().uuid(),
});

const requestChangesSchema = productReviewSchema.extend({
  reason: z.string().trim().min(10, "Add a clear reason for the listing change.").max(1000),
});

async function requireProductReviewManageAccess() {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to review products.");
  }

  return access.session;
}

async function findReviewableProduct(productId: string) {
  const [product] = await db
    .select({
      brandRequestId: products.brandRequestId,
      fulfillmentMode: products.fulfillmentMode,
      id: products.id,
      status: products.status,
      title: products.title,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  return product;
}

async function writeProductReviewAuditLog({
  action,
  actorUserId,
  entityId,
  metadata,
}: {
  action: string;
  actorUserId: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    action,
    actorUserId,
    entityId,
    entityType: "product",
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function approveProductReview(
  _state: ProductReviewMutationState,
  formData: FormData,
): Promise<ProductReviewMutationState> {
  const session = await requireProductReviewManageAccess();
  const parsed = productReviewSchema.safeParse({
    productId: formData.get("productId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Product was not found." };
  }

  const product = await findReviewableProduct(parsed.data.productId);

  if (!product) {
    return { ok: false, message: "Product was not found." };
  }

  if (product.status !== "pending_review") {
    return {
      ok: false,
      message: "Only products pending review can be approved.",
    };
  }

  if (product.brandRequestId) {
    const request = await db.query.brandRequests.findFirst({
      where: (table, { eq }) => eq(table.id, product.brandRequestId!),
    });

    if (request?.status === "pending") {
      return {
        ok: false,
        message: "Approve or reject the linked brand request before approving this product.",
      };
    }
  }

  const nextStatus = "live";

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, product.id),
          eq(products.status, "pending_review"),
        ),
      );

    await tx.insert(productReviewEvents).values({
      action: "approved",
      actorUserId: session.user.id,
      fromStatus: "pending_review",
      note:
        "Admin approved product and made it live.",
      productId: product.id,
      toStatus: nextStatus,
    });

    await tx.insert(auditLogs).values({
      action: "product_review.approved",
      actorUserId: session.user.id,
      entityId: product.id,
      entityType: "product",
      metadata: JSON.stringify({
        fulfillmentMode: product.fulfillmentMode,
        fromStatus: "pending_review",
        title: product.title,
        toStatus: nextStatus,
      }),
    });
  });

  revalidatePath("/products/reviews");

  return {
    ok: true,
    message: "Product approved and made live.",
  };
}

export async function requestProductReviewChanges(
  _state: ProductReviewMutationState,
  formData: FormData,
): Promise<ProductReviewMutationState> {
  const session = await requireProductReviewManageAccess();
  const parsed = requestChangesSchema.safeParse({
    productId: formData.get("productId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Add a clear reason for the listing change.",
    };
  }

  const product = await findReviewableProduct(parsed.data.productId);

  if (!product) {
    return { ok: false, message: "Product was not found." };
  }

  if (product.status !== "pending_review") {
    return {
      ok: false,
      message: "Only products pending review can receive requested changes.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        status: "changes_requested",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, product.id),
          eq(products.status, "pending_review"),
        ),
      );

    await tx.insert(productReviewEvents).values({
      action: "changes_requested",
      actorUserId: session.user.id,
      fromStatus: "pending_review",
      note: parsed.data.reason,
      productId: product.id,
      toStatus: "changes_requested",
    });
  });

  await writeProductReviewAuditLog({
    action: "product_review.changes_requested",
    actorUserId: session.user.id,
    entityId: product.id,
    metadata: {
      fromStatus: "pending_review",
      reason: parsed.data.reason,
      title: product.title,
      toStatus: "changes_requested",
    },
  });

  revalidatePath("/products/reviews");

  return { ok: true, message: "Changes requested." };
}
