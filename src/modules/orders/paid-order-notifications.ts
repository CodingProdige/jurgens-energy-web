import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import { adminStaff, orders, userRoles, users } from "@/src/db/schema";
import { getAdminStaffUserIdsWithCapability } from "@/src/modules/admin/staff";
import {
  claimNotificationDispatch,
  completeNotificationDispatch,
  failNotificationDispatch,
} from "@/src/modules/notifications/dispatch-claims";
import { notify } from "@/src/modules/notifications/templates";

const adminCreatedOrderEvent = "admin.order.created";
const adminPaidOrderEvent = "admin.order.paid";

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(Number(value));
}

function notificationResultSucceeded(
  result: Awaited<ReturnType<typeof notify>>,
) {
  return Boolean(
    result.inApp?.created ||
      result.email?.delivered ||
      result.push?.sentCount,
  );
}

async function getAdminOrderNotificationRecipientIds() {
  const [capabilityRecipientIds, platformAdminRows] = await Promise.all([
    getAdminStaffUserIdsWithCapability("admin.orders.manage"),
    db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .leftJoin(adminStaff, eq(adminStaff.userId, userRoles.userId))
      .where(
        and(
          eq(users.isActive, true),
          inArray(userRoles.role, ["admin", "superadmin"]),
          isNull(adminStaff.id),
        ),
      ),
  ]);

  return Array.from(
    new Set([
      ...capabilityRecipientIds,
      ...platformAdminRows.map((row) => row.userId),
    ]),
  );
}

async function getOrderNotificationData(orderId: string) {
  const [order] = await db
    .select({
      currency: orders.currency,
      customerName: orders.customerName,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return null;
  }

  return {
    data: {
      customer_name: order.customerName,
      order_id: order.id,
      order_number: order.orderNumber,
      order_total: formatMoney(order.grandTotal, order.currency),
    },
    order,
  };
}

async function notifyAdminsOfOrder({
  dedupePrefix,
  eventKey,
  logLabel,
  orderId,
  requirePaidOrder,
}: {
  dedupePrefix: string;
  eventKey: string;
  logLabel: string;
  orderId: string;
  requirePaidOrder: boolean;
}) {
  const orderData = await getOrderNotificationData(orderId);

  if (
    !orderData ||
    (requirePaidOrder &&
      !["paid", "fulfilled"].includes(orderData.order.status))
  ) {
    return {
      notified: 0,
      skipped: true,
      reason: orderData ? "order_not_paid" : "order_not_found",
    } as const;
  }

  const recipientUserIds = await getAdminOrderNotificationRecipientIds();
  const results = await Promise.allSettled(
    recipientUserIds.map(async (recipientUserId) => {
      const claim = await claimNotificationDispatch({
        dedupeKey: `${dedupePrefix}:${orderData.order.id}:${recipientUserId}`,
        eventKey,
        payload: { orderId: orderData.order.id, recipientUserId },
      });

      if (!claim.claimed) {
        return { notified: false, reason: claim.reason } as const;
      }

      try {
        const result = await notify({
          data: orderData.data,
          event: eventKey,
          recipientUserId,
        });

        if (!notificationResultSucceeded(result)) {
          throw new Error("No configured admin notification channel succeeded.");
        }

        await completeNotificationDispatch(claim.claimId, claim.claimToken);

        return { notified: true } as const;
      } catch (error) {
        await failNotificationDispatch(
          claim.claimId,
          claim.claimToken,
          error,
        );
        throw error;
      }
    }),
  );
  const notified = results.filter(
    (result) =>
      result.status === "fulfilled" && result.value.notified,
  ).length;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to notify admin ${
          recipientUserIds[index] ?? "unknown"
        } about ${logLabel} order ${orderData.order.id}.`,
        result.reason,
      );
    }
  });

  return {
    notified,
    recipients: recipientUserIds.length,
    skipped: recipientUserIds.length === 0,
  } as const;
}

export async function notifyAdminsOfCreatedOrder(orderId: string) {
  return notifyAdminsOfOrder({
    dedupePrefix: "admin-created-order",
    eventKey: adminCreatedOrderEvent,
    logLabel: "created",
    orderId,
    requirePaidOrder: false,
  });
}

export async function notifyAdminsOfPaidOrder(orderId: string) {
  return notifyAdminsOfOrder({
    dedupePrefix: "admin-paid-order",
    eventKey: adminPaidOrderEvent,
    logLabel: "paid",
    orderId,
    requirePaidOrder: true,
  });
}
