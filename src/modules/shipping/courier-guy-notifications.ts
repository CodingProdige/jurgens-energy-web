import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orders, shipments } from "@/src/db/schema";
import {
  claimNotificationDispatch,
  completeNotificationDispatch,
  failNotificationDispatch,
} from "@/src/modules/notifications/dispatch-claims";
import {
  notify,
  sendNotificationEmail,
} from "@/src/modules/notifications/templates";
import {
  getCourierGuyCustomerMilestoneLabel,
  resolveCourierGuyCustomerMilestone,
} from "@/src/modules/shipping/courier-guy-customer-status";

const customerCourierUpdateEvent = "customer.courier_shipment.updated";

function notificationResultSucceeded(
  result: Awaited<ReturnType<typeof notify>>,
) {
  return Boolean(
    result.inApp?.created ||
      result.email?.delivered ||
      result.push?.sentCount,
  );
}

export async function sendCourierGuyShipmentStatusNotification(
  shipmentId: string,
) {
  const [row] = await db
    .select({
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      shipmentStatus: shipments.status,
      trackingNumber: shipments.trackingNumber,
      trackingUrl: shipments.trackingUrl,
      userId: orders.userId,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.id, shipmentId))
    .limit(1);

  if (!row) {
    return { sent: false, skipped: true, reason: "shipment_not_found" } as const;
  }

  const milestone = resolveCourierGuyCustomerMilestone(row.shipmentStatus);

  if (!milestone || !row.trackingNumber || !row.trackingUrl) {
    return {
      sent: false,
      skipped: true,
      reason: !milestone ? "not_customer_milestone" : "tracking_unavailable",
    } as const;
  }

  const claim = await claimNotificationDispatch({
    dedupeKey: `courier-shipment:${shipmentId}:${milestone}`,
    eventKey: customerCourierUpdateEvent,
    payload: { shipmentId },
  });

  if (!claim.claimed) {
    return {
      sent: false,
      skipped: true,
      reason: claim.reason,
    } as const;
  }

  const data = {
    customer_name: row.customerName,
    order_number: row.orderNumber,
    shipment_status: getCourierGuyCustomerMilestoneLabel(milestone),
    tracking_number: row.trackingNumber,
    tracking_url: row.trackingUrl,
  };

  try {
    let outcomeUnknown = false;

    if (row.userId) {
      const result = await notify({
        data,
        event: customerCourierUpdateEvent,
        recipientEmail: row.customerEmail,
        recipientUserId: row.userId,
      });

      if (!notificationResultSucceeded(result)) {
        throw new Error("No configured customer notification channel succeeded.");
      }
    } else {
      const result = await sendNotificationEmail({
        data,
        recipientEmail: row.customerEmail,
        templateKey: customerCourierUpdateEvent,
      });

      outcomeUnknown =
        "outcomeUnknown" in result && result.outcomeUnknown === true;

      if (!result.delivered && !outcomeUnknown) {
        throw new Error(
          `Customer courier email was not delivered: ${result.reason}.`,
        );
      }
    }

    await completeNotificationDispatch(claim.claimId, claim.claimToken);

    return {
      milestone,
      outcomeUnknown,
      sent: !outcomeUnknown,
    } as const;
  } catch (error) {
    await failNotificationDispatch(claim.claimId, claim.claimToken, error);
    throw error;
  }
}
