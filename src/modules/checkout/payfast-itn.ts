import crypto from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  orderItems,
  orders,
  payments,
  productVariants,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { sendJurgensDeliveryStatusNotification } from "@/src/modules/orders/jurgens-delivery-notifications";
import {
  createPayFastItnParameterString,
  createPayFastItnSignature,
  type PayFastField,
} from "@/src/modules/checkout/payfast-signature";
import {
  completePayFastItnAuditEvent,
  createPayFastItnAuditEvent,
  type PayFastItnStage,
  redactPayFastItnPayload,
} from "@/src/modules/checkout/payfast-itn-audit";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";
import { ensureInvoiceForPaidOrder } from "@/src/modules/invoices/service";

const PAYFAST_VALIDATION_TIMEOUT_MS = 12_000;

const trustedPayFastNetworks = [
  ["197.97.145.144", 28],
  ["41.74.179.192", 27],
  ["102.216.36.0", 28],
  ["102.216.36.128", 28],
  ["144.126.193.139", 32],
] as const;

export class PayFastItnError extends Error {
  auditEventId: string | null;
  readonly code: string;
  readonly httpStatus: 400 | 503;
  readonly stage: PayFastItnStage;

  constructor({
    auditEventId = null,
    cause,
    code,
    httpStatus = 400,
    message,
    stage,
  }: {
    auditEventId?: string | null;
    cause?: unknown;
    code: string;
    httpStatus?: 400 | 503;
    message: string;
    stage: PayFastItnStage;
  }) {
    super(message, { cause });
    this.name = "PayFastItnError";
    this.auditEventId = auditEventId;
    this.code = code;
    this.httpStatus = httpStatus;
    this.stage = stage;
  }
}

function rejectPayFastItn({
  code,
  httpStatus,
  message,
  stage,
}: {
  code: string;
  httpStatus?: 400 | 503;
  message: string;
  stage: PayFastItnStage;
}): never {
  throw new PayFastItnError({ code, httpStatus, message, stage });
}

function normalizePayFastItnError(
  error: unknown,
  stage: PayFastItnStage,
) {
  if (error instanceof PayFastItnError) {
    return error;
  }

  return new PayFastItnError({
    cause: error,
    code: "processing_failed",
    httpStatus: 503,
    message: "The PayFast notification could not be processed.",
    stage,
  });
}

function ipv4ToNumber(value: string) {
  const octets = value.split(".").map(Number);

  if (
    octets.length !== 4 ||
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
    )
  ) {
    return null;
  }

  return octets.reduce((result, octet) => (result << 8) + octet, 0) >>> 0;
}

function isTrustedPayFastIp(ipAddress: string) {
  const ipNumber = ipv4ToNumber(ipAddress.replace(/^::ffff:/, ""));

  if (ipNumber === null) {
    return false;
  }

  return trustedPayFastNetworks.some(([networkAddress, prefixLength]) => {
    const networkNumber = ipv4ToNumber(networkAddress);

    if (networkNumber === null) {
      return false;
    }

    const mask = (0xffffffff << (32 - prefixLength)) >>> 0;

    return (ipNumber & mask) === (networkNumber & mask);
  });
}

function formDataToFields(formData: FormData) {
  return Array.from(formData.entries()).flatMap(([name, value]): PayFastField[] =>
    typeof value === "string" ? [{ name, value }] : [],
  );
}

function fieldsToRecord(fields: PayFastField[]) {
  return Object.fromEntries(fields.map((field) => [field.name, field.value]));
}

function timingSafeStringEqual(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer)
  );
}

async function validateWithPayFast(
  fields: PayFastField[],
  validationUrl: string,
) {
  try {
    const response = await fetch(validationUrl, {
      body: createPayFastItnParameterString(fields),
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(PAYFAST_VALIDATION_TIMEOUT_MS),
    });
    const responseBody = await response.text();

    return response.ok && responseBody.trim() === "VALID";
  } catch (error) {
    throw new PayFastItnError({
      cause: error,
      code: "provider_validation_unavailable",
      httpStatus: 503,
      message: "PayFast validation is temporarily unavailable.",
      stage: "provider_validation",
    });
  }
}

type ParcelSnapshotItem = {
  heightMm?: number;
  lengthMm?: number;
  price?: number;
  quantity?: number;
  weightGrams?: number;
  widthMm?: number;
};

function getParcelSnapshotItems(value: unknown): ParcelSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is ParcelSnapshotItem =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

async function processPayFastItnFields({
  clientIp,
  fields,
  onStage,
  payload,
}: {
  clientIp: string;
  fields: PayFastField[];
  onStage: (stage: PayFastItnStage) => void;
  payload: Record<string, string>;
}) {
  const signature = payload.signature;
  const paymentId = payload.m_payment_id;

  onStage("configuration");
  const config = await getPayFastIntegrationConfig();

  if (!config.isConfigured || !config.merchantId) {
    rejectPayFastItn({
      code: "integration_not_configured",
      httpStatus: 503,
      message: "The PayFast integration is not configured.",
      stage: "configuration",
    });
  }

  if (!signature || !paymentId) {
    rejectPayFastItn({
      code: "missing_required_fields",
      message: "The PayFast notification is missing required fields.",
      stage: "configuration",
    });
  }

  onStage("source_ip");
  if (
    process.env.NODE_ENV === "production" &&
    !isTrustedPayFastIp(clientIp)
  ) {
    rejectPayFastItn({
      code: "untrusted_source",
      message: "The PayFast notification source is not trusted.",
      stage: "source_ip",
    });
  }

  onStage("signature");
  const expectedSignature = createPayFastItnSignature(fields, config.passphrase);

  if (
    !timingSafeStringEqual(signature.toLowerCase(), expectedSignature.toLowerCase())
  ) {
    rejectPayFastItn({
      code: "invalid_signature",
      message: "The PayFast notification signature is invalid.",
      stage: "signature",
    });
  }

  onStage("merchant");
  if (payload.merchant_id !== config.merchantId) {
    rejectPayFastItn({
      code: "merchant_mismatch",
      message: "The PayFast merchant identifier does not match.",
      stage: "merchant",
    });
  }

  onStage("payment_reference");
  const [paymentRow] = await db
    .select({
      amount: payments.amount,
      id: payments.id,
      orderAmount: orders.grandTotal,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      paymentStatus: payments.status,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.id, paymentId), eq(payments.provider, "payfast")))
    .limit(1);

  if (!paymentRow) {
    rejectPayFastItn({
      code: "payment_not_found",
      message: "The PayFast payment reference was not found.",
      stage: "payment_reference",
    });
  }

  onStage("amount");
  const receivedAmount = Number(payload.amount_gross);
  const expectedAmount = Number(paymentRow.amount);
  const currentOrderAmount = Number(paymentRow.orderAmount);

  if (
    !Number.isFinite(receivedAmount) ||
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(currentOrderAmount) ||
    Math.abs(receivedAmount - expectedAmount) > 0.01 ||
    Math.abs(expectedAmount - currentOrderAmount) > 0.01
  ) {
    rejectPayFastItn({
      code: "amount_mismatch",
      message: "The PayFast payment amount does not match the order.",
      stage: "amount",
    });
  }

  onStage("provider_validation");
  if (!(await validateWithPayFast(fields, config.validationUrl))) {
    rejectPayFastItn({
      code: "provider_validation_rejected",
      message: "PayFast could not validate the notification data.",
      stage: "provider_validation",
    });
  }

  const providerStatus = payload.payment_status?.toUpperCase() ?? "UNKNOWN";
  const providerPaymentId = payload.pf_payment_id || null;
  const redactedPayload = redactPayFastItnPayload(payload);
  const now = new Date();

  if (providerStatus !== "COMPLETE") {
    onStage("payment_update");
    await db.transaction(async (tx) => {
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          providerPaymentId,
          providerStatus,
          rawPayload: redactedPayload,
          status: providerStatus === "FAILED" ? "failed" : "pending",
          updatedAt: now,
        })
        .where(
          and(
            eq(payments.id, paymentRow.id),
            eq(payments.status, "pending"),
          ),
        )
        .returning({ id: payments.id });

      if (providerStatus === "FAILED" && updatedPayment) {
        const [otherPendingAttempt] = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.orderId, paymentRow.orderId),
              eq(payments.provider, "payfast"),
              eq(payments.status, "pending"),
            ),
          )
          .limit(1);

        if (!otherPendingAttempt) {
          await tx
            .update(orders)
            .set({ status: "cancelled", updatedAt: now })
            .where(
              and(
                eq(orders.id, paymentRow.orderId),
                eq(orders.status, "pending"),
              ),
            );
        }
      }
    });

    return { completed: false, orderId: paymentRow.orderId, providerStatus };
  }

  onStage("capture");
  const completion = await db.transaction(async (tx) => {
    const [capturedPayment] = await tx
      .update(payments)
      .set({
        completedAt: now,
        providerPaymentId,
        providerStatus,
        rawPayload: redactedPayload,
        status: "captured",
        updatedAt: now,
      })
      .where(and(eq(payments.id, paymentRow.id), eq(payments.status, "pending")))
      .returning({ id: payments.id });

    if (!capturedPayment) {
      return { newlyCompleted: false };
    }

    const itemRows = await tx
      .select({
        quantity: orderItems.quantity,
        variantId: orderItems.variantId,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, paymentRow.orderId));

    for (const item of itemRows) {
      await tx
        .update(productVariants)
        .set({
          stockOnHand: sql<number>`greatest(0, ${productVariants.stockOnHand} - ${item.quantity})`,
        })
        .where(eq(productVariants.id, item.variantId));
    }

    await tx
      .update(orders)
      .set({ paidAt: now, status: "paid", updatedAt: now })
      .where(eq(orders.id, paymentRow.orderId));

    const quoteRows = await tx
      .select()
      .from(shippingRateQuotes)
      .where(
        and(
          eq(shippingRateQuotes.orderId, paymentRow.orderId),
          eq(shippingRateQuotes.status, "selected"),
        ),
      );

    for (const quote of quoteRows) {
      const [shipment] = await tx
        .insert(shipments)
        .values({
          orderId: paymentRow.orderId,
          provider: quote.provider,
          quoteId: quote.id,
          sellerId: quote.sellerId,
        })
        .returning({ id: shipments.id });

      if (quote.provider === "piessang_local") {
        await tx
          .update(jurgensDeliverySchedules)
          .set({ shipmentId: shipment.id, updatedAt: now })
          .where(
            and(
              eq(jurgensDeliverySchedules.orderId, paymentRow.orderId),
              eq(jurgensDeliverySchedules.quoteId, quote.id),
            ),
          );
      }

      const parcelItems = getParcelSnapshotItems(quote.parcelSnapshot).filter(
        (item) =>
          Number(item.heightMm) > 0 &&
          Number(item.lengthMm) > 0 &&
          Number(item.weightGrams) > 0 &&
          Number(item.widthMm) > 0,
      );

      if (parcelItems.length > 0) {
        await tx.insert(shipmentParcels).values(
          parcelItems.map((item, index) => ({
            declaredValue: Number(item.price ?? 0).toFixed(2),
            heightMm: Number(item.heightMm),
            lengthMm: Number(item.lengthMm),
            reference: `${paymentRow.orderNumber}-${index + 1}`,
            shipmentId: shipment.id,
            weightGrams: Number(item.weightGrams) * Number(item.quantity ?? 1),
            widthMm: Number(item.widthMm),
          })),
        );
      }
    }

    return { newlyCompleted: true };
  });

  await ensureInvoiceForPaidOrder(paymentRow.orderId).catch(() => null);

  if (completion.newlyCompleted) {
    await sendJurgensDeliveryStatusNotification({
      orderId: paymentRow.orderId,
    }).catch(() => null);
  }

  onStage("completed");
  return {
    completed: true,
    newlyCompleted: completion.newlyCompleted,
    orderId: paymentRow.orderId,
    providerStatus,
  };
}

export async function processPayFastItn({
  cfConnectingIp,
  clientIp,
  formData,
  xForwardedFor,
}: {
  cfConnectingIp?: string | null;
  clientIp: string;
  formData: FormData;
  xForwardedFor?: string | null;
}) {
  const fields = formDataToFields(formData);
  const payload = fieldsToRecord(fields);
  let stage: PayFastItnStage = "received";
  let auditEventId: string;

  try {
    auditEventId = await createPayFastItnAuditEvent({
      cfConnectingIp,
      payload,
      sourceIp: clientIp,
      xForwardedFor,
    });
  } catch (error) {
    console.error("[payfast-itn] audit event could not be persisted", {
      error: error instanceof Error ? error.message : "unknown_error",
      sourceIp: clientIp,
    });

    throw new PayFastItnError({
      cause: error,
      code: "audit_unavailable",
      httpStatus: 503,
      message: "The PayFast notification could not be recorded.",
      stage,
    });
  }

  try {
    const result = await processPayFastItnFields({
      clientIp,
      fields,
      onStage: (nextStage) => {
        stage = nextStage;
      },
      payload,
    });

    try {
      await completePayFastItnAuditEvent({
        eventId: auditEventId,
        stage: "completed",
        status: "processed",
      });
    } catch (error) {
      console.error("[payfast-itn] processed audit event could not be finalized", {
        auditEventId,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    console.info("[payfast-itn] notification processed", {
      auditEventId,
      completed: result.completed,
      orderId: result.orderId,
      providerStatus: result.providerStatus,
    });

    return { ...result, auditEventId };
  } catch (error) {
    const normalizedError = normalizePayFastItnError(error, stage);
    normalizedError.auditEventId = auditEventId;

    try {
      await completePayFastItnAuditEvent({
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
        eventId: auditEventId,
        stage: normalizedError.stage,
        status: "rejected",
      });
    } catch (auditError) {
      console.error("[payfast-itn] rejected audit event could not be finalized", {
        auditEventId,
        error:
          auditError instanceof Error ? auditError.message : "unknown_error",
      });
    }

    console.warn("[payfast-itn] notification rejected", {
      auditEventId,
      code: normalizedError.code,
      paymentReference: payload.m_payment_id ?? null,
      providerPaymentId: payload.pf_payment_id ?? null,
      sourceIp: clientIp,
      stage: normalizedError.stage,
    });

    throw normalizedError;
  }
}
