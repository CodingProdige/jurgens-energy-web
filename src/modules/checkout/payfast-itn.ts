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
  createPayFastParameterString,
  createPayFastSignature,
  type PayFastField,
} from "@/src/modules/checkout/payfast";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";
import { ensureInvoiceForPaidOrder } from "@/src/modules/invoices/service";

const trustedPayFastNetworks = [
  ["197.97.145.144", 28],
  ["41.74.179.192", 27],
  ["102.216.36.0", 28],
  ["102.216.36.128", 28],
  ["144.126.193.139", 32],
] as const;

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
  const response = await fetch(validationUrl, {
    body: createPayFastParameterString(fields),
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  return response.ok && (await response.text()).trim() === "VALID";
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

export async function processPayFastItn({
  clientIp,
  formData,
}: {
  clientIp: string;
  formData: FormData;
}) {
  const fields = formDataToFields(formData);
  const payload = fieldsToRecord(fields);
  const signature = payload.signature;
  const paymentId = payload.m_payment_id;
  const config = await getPayFastIntegrationConfig();

  if (
    !config.isConfigured ||
    !config.merchantId ||
    !signature ||
    !paymentId
  ) {
    throw new Error("The PayFast notification is missing required fields.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    !isTrustedPayFastIp(clientIp)
  ) {
    throw new Error("The PayFast notification source is not trusted.");
  }

  const expectedSignature = createPayFastSignature(fields, config.passphrase);

  if (
    !timingSafeStringEqual(signature.toLowerCase(), expectedSignature.toLowerCase())
  ) {
    throw new Error("The PayFast notification signature is invalid.");
  }

  if (payload.merchant_id !== config.merchantId) {
    throw new Error("The PayFast merchant identifier does not match.");
  }

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
    throw new Error("The PayFast payment reference was not found.");
  }

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
    throw new Error("The PayFast payment amount does not match the order.");
  }

  if (!(await validateWithPayFast(fields, config.validationUrl))) {
    throw new Error("PayFast could not validate the notification data.");
  }

  const providerStatus = payload.payment_status?.toUpperCase() ?? "UNKNOWN";
  const providerPaymentId = payload.pf_payment_id || null;
  const now = new Date();

  if (providerStatus !== "COMPLETE") {
    await db.transaction(async (tx) => {
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          providerPaymentId,
          providerStatus,
          rawPayload: payload,
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

  const completion = await db.transaction(async (tx) => {
    const [capturedPayment] = await tx
      .update(payments)
      .set({
        completedAt: now,
        providerPaymentId,
        providerStatus,
        rawPayload: payload,
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

  return {
    completed: true,
    newlyCompleted: completion.newlyCompleted,
    orderId: paymentRow.orderId,
    providerStatus,
  };
}
