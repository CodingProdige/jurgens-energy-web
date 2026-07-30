import { and, desc, eq, sql } from "drizzle-orm";

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
import {
  claimNotificationDispatch,
  completeNotificationDispatch,
  enqueueNotificationDispatch,
  failNotificationDispatch,
} from "@/src/modules/notifications/dispatch-claims";
import { sendNotificationEmail } from "@/src/modules/notifications/templates";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { send360DialogTextMessage } from "@/src/modules/whatsapp-ordering/360dialog";

const customerJurgensDeliveryEvent = "customer.jurgens_delivery.updated";

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

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type JurgensDeliveryNotificationRevision = {
  orderId: string;
  revision: string;
  scheduleId: string;
  status: JurgensDeliveryScheduleStatus;
};

function notificationDedupeKey({
  revision,
  scheduleId,
  status,
}: Pick<
  JurgensDeliveryNotificationRevision,
  "revision" | "scheduleId" | "status"
>) {
  return `jurgens-delivery:${scheduleId}:${status}:${revision}`;
}

export async function enqueueJurgensDeliveryStatusNotification({
  orderId,
  revision,
  scheduleId,
  status,
  transaction,
}: JurgensDeliveryNotificationRevision & {
  transaction: DatabaseTransaction;
}) {
  return enqueueNotificationDispatch({
    dedupeKey: notificationDedupeKey({
      revision,
      scheduleId,
      status,
    }),
    eventKey: customerJurgensDeliveryEvent,
    payload: {
      orderId,
      revision,
      scheduleId,
      status,
    },
    transaction,
  });
}

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
  expectedStatus,
  force = false,
  notificationRevision,
  orderId,
  scheduleId,
}: {
  expectedStatus?: JurgensDeliveryScheduleStatus;
  force?: boolean;
  notificationRevision?: string;
  orderId?: string;
  scheduleId?: string;
}) {
  if (!scheduleId && !orderId) {
    return { ok: false, skipped: true, reason: "missing_schedule" } as const;
  }

  let expected: JurgensDeliveryNotificationRevision;

  if (orderId && scheduleId && expectedStatus && notificationRevision) {
    expected = {
      orderId,
      revision: notificationRevision,
      scheduleId,
      status: expectedStatus,
    };
  } else {
    const candidateWhereClause = scheduleId
      ? eq(jurgensDeliverySchedules.id, scheduleId)
      : eq(jurgensDeliverySchedules.orderId, orderId!);
    const [candidate] = await db
      .select({
        orderId: orders.id,
        scheduleId: jurgensDeliverySchedules.id,
        status: jurgensDeliverySchedules.status,
        updatedAt: jurgensDeliverySchedules.updatedAt,
      })
      .from(jurgensDeliverySchedules)
      .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
      .where(candidateWhereClause)
      .limit(1);

    if (!candidate) {
      return {
        ok: false,
        skipped: true,
        reason: "schedule_not_found",
      } as const;
    }

    expected = {
      orderId: orderId ?? candidate.orderId,
      revision:
        notificationRevision ?? candidate.updatedAt.toISOString(),
      scheduleId: scheduleId ?? candidate.scheduleId,
      status: expectedStatus ?? candidate.status,
    };
  }
  const dedupeKey = notificationDedupeKey(expected);

  await db.transaction((transaction) =>
    enqueueJurgensDeliveryStatusNotification({
      ...expected,
      transaction,
    }),
  );

  const claim = await claimNotificationDispatch({
    dedupeKey,
    eventKey: customerJurgensDeliveryEvent,
    payload: {
      orderId: expected.orderId,
      revision: expected.revision,
      scheduleId: expected.scheduleId,
      status: expected.status,
    },
    retryNow: force,
  });

  if (!claim.claimed) {
    return {
      ok: claim.reason === "already_sent",
      skipped: true,
      reason: claim.reason,
    } as const;
  }

  try {
    const [business, settings] = await Promise.all([
      getBusinessInformation(),
      getMarketplaceSettings(),
    ]);
    const support = createCustomerSupportContactDetails({
      business,
      settings,
    });
    const supportContactSentence =
      formatCustomerSupportContactSentence(support);
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + expected.orderId}))`,
      );

      const [row] = await transaction
        .select({
          customerEmail: orders.customerEmail,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          lastNotifiedStatus:
            jurgensDeliverySchedules.lastNotifiedStatus,
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          scheduledDate: jurgensDeliverySchedules.scheduledDate,
          scheduleId: jurgensDeliverySchedules.id,
          status: jurgensDeliverySchedules.status,
          updatedAt: jurgensDeliverySchedules.updatedAt,
          userId: orders.userId,
          windowEnd: jurgensDeliverySchedules.windowEnd,
          windowLabel: jurgensDeliverySchedules.windowLabel,
          windowStart: jurgensDeliverySchedules.windowStart,
        })
        .from(jurgensDeliverySchedules)
        .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
        .where(
          and(
            eq(jurgensDeliverySchedules.id, expected.scheduleId),
            eq(jurgensDeliverySchedules.orderId, expected.orderId),
          ),
        )
        .limit(1);

      if (
        !row ||
        row.status !== expected.status ||
        row.updatedAt.toISOString() !== expected.revision ||
        row.lastNotifiedStatus === expected.status
      ) {
        return { kind: "superseded" as const };
      }

      const deliveryDate = formatScheduleDate(row.scheduledDate);
      const scheduledWindow = formatScheduleWindow(row);
      const ratingUrl = settings.googleReviewUrl;
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
            scheduled_window:
              scheduledWindow ?? "No specific time requested",
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
          reason:
            error instanceof Error ? error.message : "whatsapp_failed",
        })),
      ]);
      const emailOutcomeUnknown =
        "outcomeUnknown" in emailResult &&
        emailResult.outcomeUnknown === true;
      const delivered =
        emailResult.delivered === true ||
        emailOutcomeUnknown ||
        whatsappResult.ok === true;

      if (!delivered) {
        return {
          email: emailResult,
          kind: "failed" as const,
          whatsapp: whatsappResult,
        };
      }

      const notifiedAt = new Date();
      const [marked] = await transaction
        .update(jurgensDeliverySchedules)
        .set({
          lastNotifiedAt: notifiedAt,
          lastNotifiedStatus: row.status,
          updatedAt: notifiedAt,
        })
        .where(
          and(
            eq(jurgensDeliverySchedules.id, row.scheduleId),
            eq(jurgensDeliverySchedules.orderId, row.orderId),
            eq(jurgensDeliverySchedules.status, row.status),
            eq(jurgensDeliverySchedules.updatedAt, row.updatedAt),
          ),
        )
        .returning({ id: jurgensDeliverySchedules.id });

      if (!marked) {
        return { kind: "superseded" as const };
      }

      return {
        email: emailResult,
        kind: "delivered" as const,
        outcomeUnknown: emailOutcomeUnknown,
        whatsapp: whatsappResult,
      };
    });

    if (result.kind === "superseded") {
      await completeNotificationDispatch(claim.claimId, claim.claimToken);
      return {
        ok: false,
        skipped: true,
        reason: "superseded",
      } as const;
    }

    if (result.kind === "failed") {
      throw new Error(
        "The customer delivery update was not accepted by email or WhatsApp.",
      );
    }

    await completeNotificationDispatch(claim.claimId, claim.claimToken);

    return {
      email: result.email,
      ok: true,
      outcomeUnknown: result.outcomeUnknown,
      retryable: false,
      whatsapp: result.whatsapp,
    } as const;
  } catch (error) {
    await failNotificationDispatch(
      claim.claimId,
      claim.claimToken,
      error,
    );
    throw error;
  }
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
