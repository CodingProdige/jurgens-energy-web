import "server-only";

import { getRetryableNotificationDispatches } from "@/src/modules/notifications/dispatch-claims";
import { reconcileOutstandingOrderFulfillment } from "@/src/modules/orders/fulfillment";
import {
  notifyAdminsOfCreatedOrder,
  notifyAdminsOfPaidOrder,
  notifyAdminsOfPaidOrderWhatsapp,
} from "@/src/modules/orders/paid-order-notifications";
import {
  notifyCustomerOfPaidOrder,
  paidOrderCustomerNotificationEvents,
} from "@/src/modules/orders/paid-order-customer-notifications";
import { sendJurgensDeliveryStatusNotification } from "@/src/modules/orders/jurgens-delivery-notifications";
import {
  notifyAdminsOfOpenPaymentReconciliationExceptions,
  notifyAdminsOfPaymentReconciliationException,
} from "@/src/modules/payments/reconciliation-exceptions";
import { sendCourierGuyShipmentStatusNotification } from "@/src/modules/shipping/courier-guy-notifications";
import {
  jurgensDeliveryScheduleStatuses,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";

export async function processNotificationDispatchRetries() {
  await reconcileOutstandingOrderFulfillment().catch((error) => {
    console.error("[notification-worker] fulfilment reconciliation failed", error);
  });
  await notifyAdminsOfOpenPaymentReconciliationExceptions().catch(
    (error) => {
      console.error(
        "[notification-worker] payment reconciliation scan failed",
        error,
      );
    },
  );

  const retryRows = await getRetryableNotificationDispatches();
  const tasks = new Map<string, () => Promise<unknown>>();

  for (const row of retryRows) {
    if (
      row.eventKey === "customer.jurgens_delivery.updated" &&
      row.payload.orderId &&
      row.payload.revision &&
      row.payload.scheduleId &&
      jurgensDeliveryScheduleStatuses.includes(
        row.payload.status as JurgensDeliveryScheduleStatus,
      )
    ) {
      tasks.set(
        `jurgens-delivery:${row.payload.scheduleId}:${row.payload.status}:${row.payload.revision}`,
        () =>
          sendJurgensDeliveryStatusNotification({
            expectedStatus:
              row.payload.status as JurgensDeliveryScheduleStatus,
            notificationRevision: row.payload.revision,
            orderId: row.payload.orderId,
            scheduleId: row.payload.scheduleId,
          }),
      );
    }

    if (
      row.eventKey === "customer.courier_shipment.updated" &&
      row.payload.shipmentId
    ) {
      tasks.set(
        `shipment:${row.payload.shipmentId}`,
        () =>
          sendCourierGuyShipmentStatusNotification(
            row.payload.shipmentId,
          ),
      );
    }

    if (row.eventKey === "admin.order.paid" && row.payload.orderId) {
      tasks.set(
        `paid-order:${row.payload.orderId}`,
        () =>
          notifyAdminsOfPaidOrder(row.payload.orderId, { retryNow: true }),
      );
    }

    if (
      row.eventKey === "admin.order.paid.whatsapp" &&
      row.payload.orderId
    ) {
      tasks.set(
        `paid-order-whatsapp:${row.payload.orderId}`,
        () =>
          notifyAdminsOfPaidOrderWhatsapp(row.payload.orderId, {
            retryNow: true,
          }),
      );
    }

    if (
      (row.eventKey ===
        paidOrderCustomerNotificationEvents.customerPaidOrderEvent ||
        row.eventKey ===
          paidOrderCustomerNotificationEvents.customerPaidOrderWhatsappEvent) &&
      row.payload.orderId
    ) {
      tasks.set(
        `customer-paid-order:${row.payload.orderId}`,
        () =>
          notifyCustomerOfPaidOrder(row.payload.orderId, { retryNow: true }),
      );
    }

    if (row.eventKey === "admin.order.created" && row.payload.orderId) {
      tasks.set(
        `created-order:${row.payload.orderId}`,
        () => notifyAdminsOfCreatedOrder(row.payload.orderId),
      );
    }

    if (
      row.eventKey === "admin.payment.reconciliation_required" &&
      row.payload.exceptionId
    ) {
      tasks.set(
        `payment-exception:${row.payload.exceptionId}`,
        () =>
          notifyAdminsOfPaymentReconciliationException(
            row.payload.exceptionId,
          ),
      );
    }
  }

  const results: PromiseSettledResult<unknown>[] = [];

  // A Jurgens dispatch deliberately holds its per-order advisory lock while
  // contacting the delivery channels. Run retries serially so nested
  // notification logging cannot exhaust the shared PostgreSQL pool.
  for (const retry of tasks.values()) {
    try {
      results.push({
        status: "fulfilled",
        value: await retry(),
      });
    } catch (reason) {
      results.push({ reason, status: "rejected" });
    }
  }

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("[notification-worker] retry failed", result.reason);
    }
  });

  return {
    attempted: tasks.size,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
