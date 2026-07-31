"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  shipments,
} from "@/src/db/schema";
import {
  RetryPayFastPaymentError,
  retryHostedPayFastPayment,
} from "@/src/modules/checkout/retry-payment";
import { getAdminStaffUserIdsWithCapability } from "@/src/modules/admin/staff";
import { requireCustomerAccount } from "@/src/modules/marketplace/account/data";
import { notify } from "@/src/modules/notifications/templates";

export type RetryPaymentActionState = {
  error: string | null;
};

export type SubmitProductReviewActionState = {
  message: string | null;
  ok: boolean;
};

const orderIdSchema = z.string().uuid();
const productReviewSubmissionSchema = z.object({
  body: z
    .string()
    .trim()
    .max(2000, "Keep your review under 2,000 characters.")
    .optional()
    .transform((value) => value || null),
  orderItemId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z
    .string()
    .trim()
    .max(140, "Keep the title under 140 characters.")
    .optional()
    .transform((value) => value || null),
});

export async function retryPayFastPaymentAction(
  orderId: string,
  previousState: RetryPaymentActionState,
  formData: FormData,
): Promise<RetryPaymentActionState> {
  void previousState;
  void formData;

  const parsedOrderId = orderIdSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    return { error: "This order could not be found." };
  }

  const account = await requireCustomerAccount();
  let redirectUrl: string;

  try {
    const result = await retryHostedPayFastPayment({
      orderId: parsedOrderId.data,
      userId: account.id,
    });

    redirectUrl = result.redirectUrl;
  } catch (error) {
    if (error instanceof RetryPayFastPaymentError) {
      return { error: error.message };
    }

    console.error("Retrying PayFast checkout failed", error);

    return {
      error: "Payment could not be reopened. Please try again in a moment.",
    };
  }

  redirect(redirectUrl);
}

export async function submitOrderItemProductReviewAction(
  orderId: string,
  previousState: SubmitProductReviewActionState,
  formData: FormData,
): Promise<SubmitProductReviewActionState> {
  void previousState;

  const parsedOrderId = orderIdSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    return { ok: false, message: "This order could not be found." };
  }

  const parsed = productReviewSubmissionSchema.safeParse({
    body: formData.get("body"),
    orderItemId: formData.get("orderItemId"),
    rating: formData.get("rating"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Please choose a rating before submitting your review.",
    };
  }

  const account = await requireCustomerAccount();
  const [row] = await db
    .select({
      customerName: orders.customerName,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      productId: productVariants.productId,
      productSlug: products.slug,
      productTitle: products.title,
      reviewId: reviews.id,
      reviewStatus: reviews.status,
      variantId: orderItems.variantId,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      reviews,
      and(
        eq(reviews.orderItemId, orderItems.id),
        eq(reviews.userId, account.id),
      ),
    )
    .where(
      and(
        eq(orderItems.id, parsed.data.orderItemId),
        eq(orderItems.orderId, parsedOrderId.data),
        eq(orders.userId, account.id),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      message: "This order item could not be found on your account.",
    };
  }

  const [deliveredShipment] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(
      and(
        eq(shipments.orderId, row.orderId),
        eq(shipments.status, "delivered"),
      ),
    )
    .limit(1);
  const canReview = row.orderStatus === "fulfilled" || Boolean(deliveredShipment);

  if (!canReview) {
    return {
      ok: false,
      message: "You can review this product once the order has been delivered.",
    };
  }

  if (row.reviewId && row.reviewStatus !== "rejected") {
    return {
      ok: false,
      message:
        row.reviewStatus === "approved"
          ? "Your approved review is already live."
          : "Your review is already waiting for moderation.",
    };
  }

  const displayName =
    account.name?.trim() ||
    row.customerName.trim() ||
    account.email.split("@")[0] ||
    "Jurgens Energy customer";
  const now = new Date();

  await db.transaction(async (tx) => {
    if (row.reviewId) {
      await tx
        .update(reviews)
        .set({
          body: parsed.data.body,
          customerDisplayName: displayName,
          hiddenAt: null,
          isVerifiedPurchase: true,
          rating: parsed.data.rating,
          rejectedAt: null,
          rejectedReason: null,
          status: "pending",
          title: parsed.data.title,
          updatedAt: now,
        })
        .where(eq(reviews.id, row.reviewId));
    } else {
      await tx.insert(reviews).values({
        body: parsed.data.body,
        customerDisplayName: displayName,
        isVerifiedPurchase: true,
        orderId: row.orderId,
        orderItemId: parsed.data.orderItemId,
        productId: row.productId,
        rating: parsed.data.rating,
        status: "pending",
        title: parsed.data.title,
        updatedAt: now,
        userId: account.id,
        variantId: row.variantId,
      });
    }

    await tx.insert(auditLogs).values({
      action: row.reviewId
        ? "product_review.resubmitted"
        : "product_review.submitted",
      actorUserId: account.id,
      entityId: row.productId,
      entityType: "product",
      metadata: JSON.stringify({
        orderId: row.orderId,
        orderItemId: parsed.data.orderItemId,
        orderNumber: row.orderNumber,
        productTitle: row.productTitle,
        rating: parsed.data.rating,
      }),
    });
  });

  const recipientUserIds = await getAdminStaffUserIdsWithCapability(
    "admin.catalog.manage",
  );

  await Promise.all(
    recipientUserIds.map((recipientUserId) =>
      notify({
        data: {
          customer_name: displayName,
          product_title: row.productTitle,
          rating: parsed.data.rating,
        },
        event: "admin.customer_product_review.submitted",
        recipientUserId,
      }),
    ),
  ).catch((error) => {
    console.error("Product review admin notification failed", error);
  });

  revalidatePath(`/account/orders/${row.orderId}`);
  revalidatePath(`/products/${row.productSlug}`);
  revalidatePath("/products");

  return {
    ok: true,
    message: "Thanks — your review is waiting for approval.",
  };
}
