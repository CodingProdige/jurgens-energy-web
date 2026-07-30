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

export async function notifyAdminsOfPaidOrder(orderId: string) {
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

  if (!order || !["paid", "fulfilled"].includes(order.status)) {
    return {
      notified: 0,
      skipped: true,
      reason: order ? "order_not_paid" : "order_not_found",
    } as const;
  }

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
  const recipientUserIds = Array.from(
    new Set([
      ...capabilityRecipientIds,
      ...platformAdminRows.map((row) => row.userId),
    ]),
  );
  const data = {
    customer_name: order.customerName,
    order_id: order.id,
    order_number: order.orderNumber,
    order_total: formatMoney(order.grandTotal, order.currency),
  };
  const results = await Promise.allSettled(
    recipientUserIds.map(async (recipientUserId) => {
      const claim = await claimNotificationDispatch({
        dedupeKey: `admin-paid-order:${order.id}:${recipientUserId}`,
        eventKey: adminPaidOrderEvent,
        payload: { orderId: order.id, recipientUserId },
      });

      if (!claim.claimed) {
        return { notified: false, reason: claim.reason } as const;
      }

      try {
        const result = await notify({
          data,
          event: adminPaidOrderEvent,
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
        `Failed to notify admin ${recipientUserIds[index] ?? "unknown"} about paid order ${order.id}.`,
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
