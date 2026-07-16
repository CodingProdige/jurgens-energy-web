import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderItems, payments } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { getCheckoutOrderWithToken } from "@/src/modules/checkout/orders";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  createPayFastSignature,
  type PayFastField,
} from "@/src/modules/checkout/payfast-signature";

export {
  createPayFastItnParameterString,
  createPayFastItnSignature,
  createPayFastParameterString,
  createPayFastSignature,
  encodePayFastValue,
  type PayFastField,
} from "@/src/modules/checkout/payfast-signature";

function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? "Customer";

  return {
    firstName: firstName.slice(0, 100),
    lastName: parts.join(" ").slice(0, 100),
  };
}

export async function getHostedPayFastForm(orderId: string, token: string) {
  const [order, config] = await Promise.all([
    getCheckoutOrderWithToken(orderId, token),
    getPayFastIntegrationConfig(),
  ]);

  if (!order || !config.isConfigured || !config.merchantId || !config.merchantKey) {
    return null;
  }

  if (order.status !== "pending") {
    return null;
  }

  const [paymentRows, itemCountRows] = await Promise.all([
    db
      .select({
        amount: payments.amount,
        id: payments.id,
        status: payments.status,
      })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.id),
          eq(payments.provider, "payfast"),
          eq(payments.status, "pending"),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1),
    db
      .select({ count: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
  ]);
  const payment = paymentRows[0];

  const currentOrderAmount = Number(order.grandTotal);

  if (
    !payment ||
    payment.status !== "pending" ||
    !Number.isFinite(currentOrderAmount) ||
    currentOrderAmount < 5 ||
    Math.abs(Number(payment.amount) - currentOrderAmount) > 0.01
  ) {
    return null;
  }

  const appUrl = new URL(env.APP_URL);
  const returnUrl = new URL("/checkout/return", appUrl);
  const cancelUrl = new URL("/checkout/cancel", appUrl);
  const notifyUrl = new URL("/api/webhooks/payfast/itn", appUrl);

  for (const target of [returnUrl, cancelUrl]) {
    target.searchParams.set("order", order.id);
    target.searchParams.set("token", token);
  }

  const { firstName, lastName } = splitCustomerName(order.customerName);
  const itemCount = Number(itemCountRows[0]?.count) || 0;
  const fields: PayFastField[] = [
    { name: "merchant_id", value: config.merchantId },
    { name: "merchant_key", value: config.merchantKey },
    { name: "return_url", value: returnUrl.toString() },
    { name: "cancel_url", value: cancelUrl.toString() },
    { name: "notify_url", value: notifyUrl.toString() },
    { name: "name_first", value: firstName },
    { name: "name_last", value: lastName },
    { name: "email_address", value: order.customerEmail },
    { name: "cell_number", value: order.customerPhone },
    { name: "m_payment_id", value: payment.id },
    { name: "amount", value: currentOrderAmount.toFixed(2) },
    { name: "item_name", value: `Jurgens Energy ${order.orderNumber}`.slice(0, 100) },
    {
      name: "item_description",
      value: `${itemCount} item${itemCount === 1 ? "" : "s"} from Jurgens Energy`.slice(
        0,
        255,
      ),
    },
    { name: "custom_str1", value: order.id },
  ];

  fields.push({
    name: "signature",
    value: createPayFastSignature(fields, config.passphrase),
  });

  return {
    fields,
    orderNumber: order.orderNumber,
    processUrl: config.processUrl,
  };
}
