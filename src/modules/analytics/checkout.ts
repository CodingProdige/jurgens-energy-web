import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  checkoutAnalyticsEvents,
  checkoutAnalyticsSessions,
  brands,
  orders,
  products,
  productVariants,
} from "@/src/db/schema";
import {
  advanceCheckoutAnalyticsLifecycle,
  checkoutAnalyticsEventInputSchema,
  type CheckoutAnalyticsDeviceCategory,
  type CheckoutAnalyticsEventInput,
  type CheckoutAnalyticsSessionStatus,
} from "@/src/modules/analytics/checkout-contracts";
import type { CampaignAttributionSnapshot } from "@/src/modules/marketing/campaign-attribution";

export type RecordCheckoutAnalyticsEventContext = {
  campaignAttribution?: CampaignAttributionSnapshot | null;
  deviceCategory?: CheckoutAnalyticsDeviceCategory;
  userId?: string | null;
};

export type RecordCheckoutAnalyticsEventResult = {
  duplicate: boolean;
  eventId: string;
  sessionId: string;
  status: CheckoutAnalyticsSessionStatus;
};

export type CheckoutAnalyticsOrderEventInput = {
  errorCode?: string;
  event: "checkout_failed" | "payment_cancelled" | "payment_confirmed";
  eventId: string;
  orderId: string;
};

const checkoutAnalyticsOrderEventInputSchema = z
  .object({
    errorCode: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9._:-]*$/)
      .optional(),
    event: z.enum([
      "checkout_failed",
      "payment_cancelled",
      "payment_confirmed",
    ]),
    eventId: z.string().uuid(),
    orderId: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.event === "checkout_failed" && !value.errorCode) {
      context.addIssue({
        code: "custom",
        message: "Checkout failures require a stable error code.",
        path: ["errorCode"],
      });
    }

    if (value.event === "payment_confirmed" && value.errorCode) {
      context.addIssue({
        code: "custom",
        message: "Confirmed payments cannot include an error code.",
        path: ["errorCode"],
      });
    }
  });

export class CheckoutAnalyticsConflictError extends Error {
  constructor(message = "Checkout analytics identifiers conflict.") {
    super(message);
    this.name = "CheckoutAnalyticsConflictError";
  }
}

export class CheckoutAnalyticsCompletedSessionError extends Error {
  constructor() {
    super("The checkout analytics session is already complete.");
    this.name = "CheckoutAnalyticsCompletedSessionError";
  }
}

export class CheckoutAnalyticsOrderNotFoundError extends Error {
  constructor() {
    super("The linked checkout order does not exist.");
    this.name = "CheckoutAnalyticsOrderNotFoundError";
  }
}

export class CheckoutAnalyticsProductNotFoundError extends Error {
  constructor() {
    super("The analytics product or variant does not exist.");
    this.name = "CheckoutAnalyticsProductNotFoundError";
  }
}

function initialLifecycle(
  event: CheckoutAnalyticsEventInput["event"],
  occurredAt: Date,
) {
  return advanceCheckoutAnalyticsLifecycle({
    current: {
      completedAt: null,
      failedAt: null,
      latestStep: event,
      status: "active",
    },
    event,
    occurredAt,
  });
}

export async function recordCheckoutAnalyticsEvent(
  input: CheckoutAnalyticsEventInput,
  context: RecordCheckoutAnalyticsEventContext = {},
): Promise<RecordCheckoutAnalyticsEventResult> {
  const parsed = checkoutAnalyticsEventInputSchema.parse(input);
  const occurredAt = new Date();
  const cartValue = parsed.cart?.value.toFixed(2) ?? null;
  const contextUserId = context.userId ?? null;
  const initial = initialLifecycle(parsed.event, occurredAt);

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.sessionId}))`,
    );

    const [existingEvent] = await transaction
      .select({
        sessionId: checkoutAnalyticsEvents.sessionId,
      })
      .from(checkoutAnalyticsEvents)
      .where(eq(checkoutAnalyticsEvents.id, parsed.eventId))
      .limit(1);

    if (existingEvent) {
      if (existingEvent.sessionId !== parsed.sessionId) {
        throw new CheckoutAnalyticsConflictError();
      }

      const [existingSession] = await transaction
        .select({ status: checkoutAnalyticsSessions.status })
        .from(checkoutAnalyticsSessions)
        .where(eq(checkoutAnalyticsSessions.id, parsed.sessionId))
        .limit(1);

      if (!existingSession) {
        throw new CheckoutAnalyticsConflictError();
      }

      return {
        duplicate: true,
        eventId: parsed.eventId,
        sessionId: parsed.sessionId,
        status: existingSession.status,
      };
    }

    let linkedOrderUserId: string | null = null;
    let productSnapshot: {
      brandName: string | null;
      productId: string;
      productTitle: string;
      variantId: string;
      variantTitle: string;
    } | null = null;

    if (parsed.product) {
      const [linkedProduct] = await transaction
        .select({
          brandName: brands.name,
          productId: products.id,
          productTitle: products.title,
          variantId: productVariants.id,
          variantTitle: productVariants.title,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(eq(productVariants.id, parsed.product.variantId))
        .limit(1);

      if (
        !linkedProduct ||
        linkedProduct.productId !== parsed.product.productId
      ) {
        throw new CheckoutAnalyticsProductNotFoundError();
      }

      productSnapshot = linkedProduct;
    }

    if (parsed.orderId) {
      const [linkedOrder] = await transaction
        .select({ userId: orders.userId })
        .from(orders)
        .where(eq(orders.id, parsed.orderId))
        .limit(1);

      if (!linkedOrder) {
        throw new CheckoutAnalyticsOrderNotFoundError();
      }

      linkedOrderUserId = linkedOrder.userId;

      if (
        contextUserId &&
        linkedOrder.userId &&
        linkedOrder.userId !== contextUserId
      ) {
        throw new CheckoutAnalyticsConflictError();
      }
    }

    await transaction
      .insert(checkoutAnalyticsSessions)
      .values({
        campaignAttributionSnapshot:
          context.campaignAttribution ?? null,
        cartValue,
        cartStartedAt:
          parsed.event === "add_to_cart" ? occurredAt : null,
        checkoutStartedAt: parsed.event === "started" ? occurredAt : null,
        completedAt: initial.completedAt,
        currency: parsed.cart?.currency ?? null,
        deviceCategory: context.deviceCategory ?? "unknown",
        failedAt: initial.failedAt,
        firstSeenAt: occurredAt,
        id: parsed.sessionId,
        itemCount: parsed.cart?.itemCount ?? null,
        landingPath: parsed.landingPath ?? null,
        lastErrorCode: parsed.errorCode ?? null,
        lastCartActivityAt:
          parsed.event === "add_to_cart" ? occurredAt : null,
        lastSeenAt: occurredAt,
        latestStep: initial.latestStep,
        orderId: parsed.orderId ?? null,
        referrerHost: parsed.referrerHost ?? null,
        status: initial.status,
        totalQuantity: parsed.cart?.totalQuantity ?? null,
        userId: contextUserId ?? linkedOrderUserId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      })
      .onConflictDoNothing({ target: checkoutAnalyticsSessions.id });

    const [currentSession] = await transaction
      .select()
      .from(checkoutAnalyticsSessions)
      .where(eq(checkoutAnalyticsSessions.id, parsed.sessionId))
      .limit(1)
      .for("update");

    if (!currentSession) {
      throw new CheckoutAnalyticsConflictError();
    }

    if (
      currentSession.userId &&
      contextUserId &&
      currentSession.userId !== contextUserId
    ) {
      throw new CheckoutAnalyticsConflictError();
    }

    if (
      currentSession.orderId &&
      parsed.orderId &&
      currentSession.orderId !== parsed.orderId
    ) {
      throw new CheckoutAnalyticsConflictError();
    }

    if (
      parsed.event === "add_to_cart" &&
      currentSession.status === "completed"
    ) {
      throw new CheckoutAnalyticsCompletedSessionError();
    }

    const effectiveOrderId = parsed.orderId ?? currentSession.orderId;
    const effectiveUserId =
      contextUserId ?? currentSession.userId ?? linkedOrderUserId;
    const lifecycle = advanceCheckoutAnalyticsLifecycle({
      current: {
        completedAt: currentSession.completedAt,
        failedAt: currentSession.failedAt,
        latestStep: currentSession.latestStep,
        status: currentSession.status,
      },
      event: parsed.event,
      occurredAt,
    });

    const [insertedEvent] = await transaction
      .insert(checkoutAnalyticsEvents)
      .values({
        cartValue,
        currency: parsed.cart?.currency ?? null,
        errorCode: parsed.errorCode ?? null,
        eventName: parsed.event,
        id: parsed.eventId,
        itemCount: parsed.cart?.itemCount ?? null,
        occurredAt,
        orderId: effectiveOrderId,
        brandNameSnapshot: productSnapshot?.brandName ?? null,
        productId: productSnapshot?.productId ?? null,
        productTitleSnapshot: productSnapshot?.productTitle ?? null,
        quantityDelta: parsed.product?.quantity ?? null,
        sessionId: parsed.sessionId,
        totalQuantity: parsed.cart?.totalQuantity ?? null,
        userId: effectiveUserId,
        variantId: productSnapshot?.variantId ?? null,
        variantTitleSnapshot: productSnapshot?.variantTitle ?? null,
      })
      .onConflictDoNothing({ target: checkoutAnalyticsEvents.id })
      .returning({ id: checkoutAnalyticsEvents.id });

    if (!insertedEvent) {
      const [conflictingEvent] = await transaction
        .select({ sessionId: checkoutAnalyticsEvents.sessionId })
        .from(checkoutAnalyticsEvents)
        .where(eq(checkoutAnalyticsEvents.id, parsed.eventId))
        .limit(1);

      if (conflictingEvent?.sessionId !== parsed.sessionId) {
        throw new CheckoutAnalyticsConflictError();
      }

      return {
        duplicate: true,
        eventId: parsed.eventId,
        sessionId: parsed.sessionId,
        status: currentSession.status,
      };
    }

    await transaction
      .update(checkoutAnalyticsSessions)
      .set({
        campaignAttributionSnapshot:
          currentSession.campaignAttributionSnapshot ??
          context.campaignAttribution ??
          null,
        cartValue: cartValue ?? currentSession.cartValue,
        cartStartedAt:
          currentSession.cartStartedAt ??
          (parsed.event === "add_to_cart" ? occurredAt : null),
        completedAt: lifecycle.completedAt,
        currency: parsed.cart?.currency ?? currentSession.currency,
        deviceCategory:
          currentSession.deviceCategory === "unknown"
            ? (context.deviceCategory ?? "unknown")
            : currentSession.deviceCategory,
        failedAt: lifecycle.failedAt,
        checkoutStartedAt:
          currentSession.checkoutStartedAt ??
          (parsed.event === "started" ? occurredAt : null),
        itemCount: parsed.cart?.itemCount ?? currentSession.itemCount,
        landingPath: currentSession.landingPath ?? parsed.landingPath ?? null,
        lastErrorCode:
          parsed.errorCode ?? currentSession.lastErrorCode,
        lastCartActivityAt:
          parsed.event === "add_to_cart"
            ? occurredAt
            : currentSession.lastCartActivityAt,
        lastSeenAt: occurredAt,
        latestStep: lifecycle.latestStep,
        orderId: effectiveOrderId,
        referrerHost:
          currentSession.referrerHost ?? parsed.referrerHost ?? null,
        status: lifecycle.status,
        totalQuantity:
          parsed.cart?.totalQuantity ?? currentSession.totalQuantity,
        updatedAt: occurredAt,
        userId: effectiveUserId,
      })
      .where(eq(checkoutAnalyticsSessions.id, parsed.sessionId));

    return {
      duplicate: false,
      eventId: parsed.eventId,
      sessionId: parsed.sessionId,
      status: lifecycle.status,
    };
  });
}

export async function recordCheckoutAnalyticsEventForOrder(
  input: CheckoutAnalyticsOrderEventInput,
): Promise<RecordCheckoutAnalyticsEventResult | null> {
  const parsed = checkoutAnalyticsOrderEventInputSchema.parse(input);
  const [session] = await db
    .select({
      id: checkoutAnalyticsSessions.id,
      userId: checkoutAnalyticsSessions.userId,
    })
    .from(checkoutAnalyticsSessions)
    .where(eq(checkoutAnalyticsSessions.orderId, parsed.orderId))
    .orderBy(desc(checkoutAnalyticsSessions.lastSeenAt))
    .limit(1);

  if (!session) {
    return null;
  }

  return recordCheckoutAnalyticsEvent(
    {
      errorCode: parsed.errorCode,
      event: parsed.event,
      eventId: parsed.eventId,
      orderId: parsed.orderId,
      sessionId: session.id,
    },
    { userId: session.userId },
  );
}
