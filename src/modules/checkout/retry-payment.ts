import "server-only";

import { createHash, createHmac } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { orders, payments } from "@/src/db/schema";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";

const retryPaymentInputSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type RetryPayFastPaymentErrorCode =
  | "amount_changed"
  | "not_configured"
  | "not_eligible"
  | "not_found";

export class RetryPayFastPaymentError extends Error {
  code: RetryPayFastPaymentErrorCode;

  constructor(code: RetryPayFastPaymentErrorCode, message: string) {
    super(message);
    this.name = "RetryPayFastPaymentError";
    this.code = code;
  }
}

function hashCheckoutToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createStableRetryToken({
  orderId,
  paymentId,
  userId,
}: {
  orderId: string;
  paymentId: string;
  userId: string;
}) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required.");
  }

  return createHmac("sha256", secret)
    .update(`payfast-retry:${userId}:${orderId}:${paymentId}`)
    .digest("base64url");
}

function isCurrentAmount(value: string | number, currentAmount: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && Math.abs(parsed - currentAmount) <= 0.01;
}

export async function retryHostedPayFastPayment(input: {
  orderId: string;
  userId: string;
}) {
  const parsed = retryPaymentInputSchema.parse(input);
  const payFastConfig = await getPayFastIntegrationConfig();

  if (
    !payFastConfig.isConfigured ||
    !payFastConfig.merchantId ||
    !payFastConfig.merchantKey
  ) {
    throw new RetryPayFastPaymentError(
      "not_configured",
      "Secure PayFast checkout is temporarily unavailable. Please try again later.",
    );
  }

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        checkoutTokenHash: orders.checkoutTokenHash,
        grandTotal: orders.grandTotal,
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, parsed.orderId),
          eq(orders.userId, parsed.userId),
        ),
      )
      .limit(1)
      .for("update");

    if (!order) {
      throw new RetryPayFastPaymentError(
        "not_found",
        "This order could not be found in your account.",
      );
    }

    const paymentRows = await tx
      .select({
        amount: payments.amount,
        createdAt: payments.createdAt,
        id: payments.id,
        provider: payments.provider,
        status: payments.status,
      })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.id),
          eq(payments.provider, "payfast"),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .for("update");
    const latestPayment = paymentRows[0] ?? null;
    const pendingPayment = paymentRows.find(
      (payment) => payment.status === "pending",
    );
    const hasCompletedPayment = paymentRows.some((payment) =>
      ["authorized", "captured", "refunded"].includes(payment.status),
    );
    const eligiblePendingOrder =
      !hasCompletedPayment &&
      order.status === "pending" &&
      (Boolean(pendingPayment) ||
        !latestPayment ||
        latestPayment.status === "failed");
    const eligibleFailedOrder =
      !hasCompletedPayment &&
      order.status === "cancelled" && latestPayment?.status === "failed";

    if (!eligiblePendingOrder && !eligibleFailedOrder) {
      throw new RetryPayFastPaymentError(
        "not_eligible",
        "This order is no longer awaiting payment.",
      );
    }

    const currentAmount = Number(order.grandTotal);

    if (!Number.isFinite(currentAmount) || currentAmount < 5) {
      throw new RetryPayFastPaymentError(
        "amount_changed",
        "This order total cannot be sent to PayFast. Please contact Jurgens Energy for help.",
      );
    }

    if (
      pendingPayment &&
      !isCurrentAmount(pendingPayment.amount, currentAmount)
    ) {
      throw new RetryPayFastPaymentError(
        "amount_changed",
        "The pending payment no longer matches the order total. Please contact Jurgens Energy before paying.",
      );
    }

    let paymentId = pendingPayment?.id;

    if (!paymentId) {
      const [payment] = await tx
        .insert(payments)
        .values({
          amount: currentAmount.toFixed(2),
          orderId: order.id,
          provider: "payfast",
        })
        .returning({ id: payments.id });

      paymentId = payment.id;
    }

    const checkoutToken = createStableRetryToken({
      orderId: order.id,
      paymentId,
      userId: parsed.userId,
    });

    await tx
      .update(orders)
      .set({
        checkoutTokenHash: hashCheckoutToken(checkoutToken),
        status: "pending",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, order.id),
          eq(orders.userId, parsed.userId),
        ),
      );

    return {
      checkoutToken,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId,
      redirectUrl: `/checkout/payfast/${order.id}?token=${encodeURIComponent(checkoutToken)}`,
    };
  });
}
