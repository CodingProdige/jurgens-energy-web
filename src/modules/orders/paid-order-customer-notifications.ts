import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import { orders } from "@/src/db/schema";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getPublicDeliveryTimingDescription } from "@/src/modules/marketplace/public-delivery-copy";
import {
  claimNotificationDispatch,
  completeNotificationDispatch,
  failNotificationDispatch,
} from "@/src/modules/notifications/dispatch-claims";
import {
  createInAppNotification,
  sendNotificationEmail,
} from "@/src/modules/notifications/templates";
import { send360DialogOrderConfirmationTemplateMessage } from "@/src/modules/whatsapp-ordering/360dialog";

const customerPaidOrderEvent = "customer.order.paid";
const customerPaidOrderWhatsappEvent = "customer.order.paid.whatsapp";

type PaidOrderCustomerNotificationOptions = {
  force?: boolean;
  retryNow?: boolean;
};

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(Number(value));
}

function getCustomerOrderUrl(orderId: string) {
  return new URL(`/account/orders/${orderId}`, env.APP_URL).toString();
}

function getDeliveryWindow(settings: Awaited<ReturnType<typeof getMarketplaceSettings>>) {
  return getPublicDeliveryTimingDescription(settings);
}

async function getPaidOrderNotificationData(orderId: string) {
  const [order] = await db
    .select({
      currency: orders.currency,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      userId: orders.userId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !["paid", "fulfilled"].includes(order.status)) {
    return null;
  }

  const settings = await getMarketplaceSettings();
  const orderUrl = getCustomerOrderUrl(order.id);

  return {
    data: {
      customer_name: order.customerName,
      delivery_window: getDeliveryWindow(settings),
      order_id: order.id,
      order_number: order.orderNumber,
      order_total: formatMoney(order.grandTotal, order.currency),
      order_url: orderUrl,
    },
    order,
    orderUrl,
  };
}

async function notifyCustomerByEmailAndInApp(
  orderId: string,
  options: PaidOrderCustomerNotificationOptions,
) {
  const orderData = await getPaidOrderNotificationData(orderId);

  if (!orderData) {
    return { reason: "order_not_paid_or_missing", skipped: true } as const;
  }

  const dedupeKey = options.force
    ? `customer-paid-order:${orderData.order.id}:manual:${randomUUID()}`
    : `customer-paid-order:${orderData.order.id}`;
  const claim = await claimNotificationDispatch({
    dedupeKey,
    eventKey: customerPaidOrderEvent,
    payload: { orderId: orderData.order.id },
    retryNow: options.retryNow ?? false,
  });

  if (!claim.claimed) {
    return { reason: claim.reason, skipped: true } as const;
  }

  try {
    const [emailResult, inAppResult] = await Promise.all([
      sendNotificationEmail({
        data: orderData.data,
        recipientEmail: orderData.order.customerEmail,
        recipientUserId: orderData.order.userId ?? undefined,
        templateKey: customerPaidOrderEvent,
      }),
      orderData.order.userId
        ? createInAppNotification({
            data: orderData.data,
            recipientUserId: orderData.order.userId,
            templateKey: customerPaidOrderEvent,
          })
        : Promise.resolve(null),
    ]);

    if (!emailResult.delivered && !inAppResult?.created) {
      throw new Error(
        emailResult.reason ?? "Customer paid-order notification was not delivered.",
      );
    }

    await completeNotificationDispatch(claim.claimId, claim.claimToken);

    return {
      emailDelivered: emailResult.delivered,
      inAppCreated: Boolean(inAppResult?.created),
      notified: true,
    } as const;
  } catch (error) {
    await failNotificationDispatch(claim.claimId, claim.claimToken, error);
    throw error;
  }
}

async function notifyCustomerByWhatsapp(
  orderId: string,
  options: PaidOrderCustomerNotificationOptions,
) {
  const orderData = await getPaidOrderNotificationData(orderId);

  if (!orderData) {
    return { reason: "order_not_paid_or_missing", skipped: true } as const;
  }

  if (!orderData.order.customerPhone.trim()) {
    return { reason: "missing_customer_phone", skipped: true } as const;
  }

  const dedupeKey = options.force
    ? `customer-paid-order-whatsapp:${orderData.order.id}:manual:${randomUUID()}`
    : `customer-paid-order-whatsapp:${orderData.order.id}`;
  const claim = await claimNotificationDispatch({
    dedupeKey,
    eventKey: customerPaidOrderWhatsappEvent,
    payload: { orderId: orderData.order.id },
    retryNow: options.retryNow ?? false,
  });

  if (!claim.claimed) {
    return { reason: claim.reason, skipped: true } as const;
  }

  try {
    const result = await send360DialogOrderConfirmationTemplateMessage({
      customerName: orderData.order.customerName,
      deliveryWindow: orderData.data.delivery_window,
      orderNumber: orderData.order.orderNumber,
      orderTotal: orderData.data.order_total,
      orderUrl: orderData.orderUrl,
      to: orderData.order.customerPhone,
    });

    if (!result.ok) {
      throw new Error(
        result.reason ??
          (result.status ? `360dialog status ${result.status}` : "send_failed"),
      );
    }

    await completeNotificationDispatch(claim.claimId, claim.claimToken);

    return {
      notified: true,
      providerMessageId: result.providerMessageId,
    } as const;
  } catch (error) {
    await failNotificationDispatch(claim.claimId, claim.claimToken, error);
    throw error;
  }
}

export async function notifyCustomerOfPaidOrder(
  orderId: string,
  options: PaidOrderCustomerNotificationOptions = {},
) {
  const [emailAndInApp, whatsapp] = await Promise.allSettled([
    notifyCustomerByEmailAndInApp(orderId, options),
    notifyCustomerByWhatsapp(orderId, options),
  ]);

  if (emailAndInApp.status === "rejected") {
    console.error(
      `[paid-order-customer-notifications] customer email/in-app failed for order ${orderId}`,
      emailAndInApp.reason,
    );
  }

  if (whatsapp.status === "rejected") {
    console.error(
      `[paid-order-customer-notifications] customer WhatsApp failed for order ${orderId}`,
      whatsapp.reason,
    );
  }

  return {
    emailAndInApp:
      emailAndInApp.status === "fulfilled" ? emailAndInApp.value : null,
    whatsapp: whatsapp.status === "fulfilled" ? whatsapp.value : null,
  } as const;
}

export const paidOrderCustomerNotificationEvents = {
  customerPaidOrderEvent,
  customerPaidOrderWhatsappEvent,
} as const;
