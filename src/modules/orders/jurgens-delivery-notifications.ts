import { and, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  orders,
  whatsappConversations,
  whatsappMessages,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";
import { getBusinessInformation } from "@/src/modules/business-information";
import {
  createCustomerSupportContactDetails,
  formatCustomerSupportContactSentence,
} from "@/src/modules/customer-support/contact-details";
import {
  formatScheduleDate,
  formatScheduleWindow,
} from "@/src/modules/delivery-scheduling/jurgens";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { sendNotificationEmail } from "@/src/modules/notifications/templates";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { send360DialogTextMessage } from "@/src/modules/whatsapp-ordering/360dialog";

const statusLabels: Record<JurgensDeliveryScheduleStatus, string> = {
  cancelled: "Cancelled",
  completed: "Delivered",
  missed: "Delivery missed",
  out_for_delivery: "Out for delivery",
  preparing: "Preparing delivery",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
};

type DeliveryNotificationContext = {
  customerName: string;
  deliveryDate: string;
  orderNumber: string;
  ratingUrl: string | null;
  scheduledWindow: string | null;
  status: JurgensDeliveryScheduleStatus;
  supportContactSentence: string | null;
};

function getStatusMessage({
  customerName,
  deliveryDate,
  orderNumber,
  ratingUrl,
  scheduledWindow,
  status,
  supportContactSentence,
}: DeliveryNotificationContext) {
  if (status === "scheduled") {
    return `Your Jurgens Energy delivery for order ${orderNumber} is scheduled for ${deliveryDate}${scheduledWindow ? ` during ${scheduledWindow}` : ""}.`;
  }

  if (status === "preparing") {
    return `We are preparing your Jurgens Energy delivery for order ${orderNumber}. Your requested delivery date is ${deliveryDate}${scheduledWindow ? ` during ${scheduledWindow}` : ""}.`;
  }

  if (status === "out_for_delivery") {
    return `Your Jurgens Energy order ${orderNumber} is out for delivery. Please keep your phone nearby${scheduledWindow ? ` during ${scheduledWindow}` : ""}.`;
  }

  if (status === "completed") {
    const ratingText = ratingUrl
      ? ` If everything went smoothly, we would really appreciate your Google review: ${ratingUrl}`
      : "";

    return `Thanks ${customerName}, your Jurgens Energy order ${orderNumber} has been delivered.${ratingText}`;
  }

  if (status === "missed") {
    return [
      `We could not complete delivery for order ${orderNumber}. Reply to this WhatsApp message and we will help reschedule.`,
      supportContactSentence,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (status === "rescheduled") {
    return `Your Jurgens Energy delivery for order ${orderNumber} has been rescheduled for ${deliveryDate}${scheduledWindow ? ` during ${scheduledWindow}` : ""}.`;
  }

  return [
    `Your Jurgens Energy delivery for order ${orderNumber} has been cancelled.`,
    supportContactSentence ?? "Reply to this WhatsApp message if you need help.",
  ].join(" ");
}

export async function sendJurgensDeliveryStatusNotification({
  force = false,
  orderId,
  scheduleId,
}: {
  force?: boolean;
  orderId?: string;
  scheduleId?: string;
}) {
  if (!scheduleId && !orderId) {
    return { ok: false, skipped: true, reason: "missing_schedule" } as const;
  }

  const whereClause = scheduleId
    ? eq(jurgensDeliverySchedules.id, scheduleId)
    : eq(jurgensDeliverySchedules.orderId, orderId!);
  const [row] = await db
    .select({
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      lastNotifiedStatus: jurgensDeliverySchedules.lastNotifiedStatus,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      scheduledDate: jurgensDeliverySchedules.scheduledDate,
      scheduleId: jurgensDeliverySchedules.id,
      status: jurgensDeliverySchedules.status,
      userId: orders.userId,
      windowEnd: jurgensDeliverySchedules.windowEnd,
      windowLabel: jurgensDeliverySchedules.windowLabel,
      windowStart: jurgensDeliverySchedules.windowStart,
    })
    .from(jurgensDeliverySchedules)
    .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
    .where(whereClause)
    .limit(1);

  if (!row) {
    return { ok: false, skipped: true, reason: "schedule_not_found" } as const;
  }

  if (!force && row.lastNotifiedStatus === row.status) {
    return { ok: false, skipped: true, reason: "already_notified" } as const;
  }

  const [business, settings] = await Promise.all([
    getBusinessInformation(),
    getMarketplaceSettings(),
  ]);
  const support = createCustomerSupportContactDetails({ business, settings });
  const deliveryDate = formatScheduleDate(row.scheduledDate);
  const scheduledWindow = formatScheduleWindow(row);
  const ratingUrl = settings.googleReviewUrl;
  const supportContactSentence = formatCustomerSupportContactSentence(support);
  const statusMessage = getStatusMessage({
    customerName: row.customerName,
    deliveryDate,
    orderNumber: row.orderNumber,
    ratingUrl,
    scheduledWindow,
    status: row.status,
    supportContactSentence,
  });
  const ratingLink =
    row.status === "completed" && ratingUrl
      ? `Review Jurgens Energy: ${ratingUrl}`
      : "";

  const [emailResult, whatsappResult] = await Promise.all([
    sendNotificationEmail({
      data: {
        customer_name: row.customerName,
        delivery_date: deliveryDate,
        delivery_status: statusLabels[row.status],
        order_number: row.orderNumber,
        rating_link: ratingLink,
        scheduled_window: scheduledWindow ?? "No specific time requested",
        status_message: statusMessage,
      },
      recipientEmail: row.customerEmail,
      recipientUserId: row.userId ?? undefined,
      templateKey: "customer_jurgens_delivery_update",
    }).catch((error) => ({
      delivered: false,
      reason: error instanceof Error ? error.message : "email_failed",
    })),
    sendWhatsappDeliveryStatusMessage({
      body: statusMessage,
      customerPhone: row.customerPhone,
    }).catch((error) => ({
      ok: false,
      reason: error instanceof Error ? error.message : "whatsapp_failed",
    })),
  ]);

  await db
    .update(jurgensDeliverySchedules)
    .set({
      lastNotifiedAt: new Date(),
      lastNotifiedStatus: row.status,
      updatedAt: new Date(),
    })
    .where(eq(jurgensDeliverySchedules.id, row.scheduleId));

  return {
    email: emailResult,
    ok: true,
    whatsapp: whatsappResult,
  } as const;
}

async function sendWhatsappDeliveryStatusMessage({
  body,
  customerPhone,
}: {
  body: string;
  customerPhone: string;
}) {
  const phone = normalizePhoneNumber(customerPhone.replace(/^whatsapp:/i, ""), {
    defaultCountryCode: "ZA",
  });

  if (!phone) {
    return { ok: false, skipped: true, reason: "invalid_phone" } as const;
  }

  const result = await send360DialogTextMessage({ body, to: phone });

  if (!result.ok) {
    return result;
  }

  const [conversation] = await db
    .select({
      id: whatsappConversations.id,
      provider: whatsappConversations.provider,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .orderBy(desc(whatsappConversations.updatedAt))
    .limit(1);

  if (!conversation) {
    return result;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(whatsappMessages).values({
      body,
      conversationId: conversation.id,
      direction: "outbound",
      provider: conversation.provider || "360dialog",
    });
    await tx
      .update(whatsappConversations)
      .set({
        lastIntent: "delivery_status",
        lastOutboundAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conversation.id));
  });

  return result;
}

export async function linkJurgensDeliveryScheduleToShipment({
  orderId,
  quoteId,
  shipmentId,
}: {
  orderId: string;
  quoteId: string;
  shipmentId: string;
}) {
  await db
    .update(jurgensDeliverySchedules)
    .set({ shipmentId, updatedAt: new Date() })
    .where(
      and(
        eq(jurgensDeliverySchedules.orderId, orderId),
        eq(jurgensDeliverySchedules.quoteId, quoteId),
      ),
    );
}
