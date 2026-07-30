import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  adminStaff,
  orders,
  paymentReconciliationExceptions,
  payments,
  userRoles,
  users,
  type PaymentReconciliationExceptionReason,
} from "@/src/db/schema";
import { getAdminStaffUserIdsWithCapability } from "@/src/modules/admin/staff";
import {
  claimNotificationDispatch,
  completeNotificationDispatch,
  failNotificationDispatch,
} from "@/src/modules/notifications/dispatch-claims";
import { notify } from "@/src/modules/notifications/templates";

const adminPaymentReconciliationEvent =
  "admin.payment.reconciliation_required";

const reconciliationDetailByReason: Record<
  PaymentReconciliationExceptionReason,
  string
> = {
  inventory_reservation_invalid:
    "PayFast confirmed the payment, but the order inventory hold is inconsistent. The order was not captured or released for fulfilment.",
  inventory_unavailable_after_expiry:
    "PayFast confirmed the payment after the inventory hold had expired, but the required stock is no longer available. The order was not captured or released for fulfilment.",
};

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(Number(value));
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
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

async function getAdminOrderRecipientIds() {
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

export async function recordPaymentReconciliationException({
  amount,
  auditEventId,
  orderId,
  paymentId,
  providerPaymentId,
  rawPayload,
  reason,
}: {
  amount: string;
  auditEventId: string;
  orderId: string;
  paymentId: string;
  providerPaymentId: string | null;
  rawPayload: Record<string, unknown>;
  reason: PaymentReconciliationExceptionReason;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    // PayFast has confirmed the money, but this is deliberately not a captured
    // commerce payment: inventory was not safely assigned. Persisting COMPLETE
    // prevents a duplicate ITN from silently retrying capture later.
    await tx
      .update(payments)
      .set({
        completedAt: null,
        providerPaymentId,
        providerStatus: "COMPLETE",
        rawPayload,
        status: "failed",
        updatedAt: now,
      })
      .where(eq(payments.id, paymentId));

    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));

    const [exception] = await tx
      .insert(paymentReconciliationExceptions)
      .values({
        detail: reconciliationDetailByReason[reason],
        latestItnEventId: auditEventId,
        lastSeenAt: now,
        orderId,
        paymentId,
        providerPaymentId,
        providerStatus: "COMPLETE",
        reason,
        receivedAmount: amount,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: paymentReconciliationExceptions.paymentId,
        set: {
          latestItnEventId: auditEventId,
          lastSeenAt: now,
          occurrences: sql`${paymentReconciliationExceptions.occurrences} + 1`,
          providerPaymentId,
          providerStatus: "COMPLETE",
          reason,
          receivedAmount: amount,
          updatedAt: now,
        },
      })
      .returning({
        id: paymentReconciliationExceptions.id,
        status: paymentReconciliationExceptions.status,
      });

    if (!exception) {
      throw new Error("Could not persist the payment reconciliation exception.");
    }

    return exception;
  });
}

export async function notifyAdminsOfPaymentReconciliationException(
  exceptionId: string,
) {
  const [exception] = await db
    .select({
      customerName: orders.customerName,
      currency: orders.currency,
      id: paymentReconciliationExceptions.id,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      providerPaymentId:
        paymentReconciliationExceptions.providerPaymentId,
      reason: paymentReconciliationExceptions.reason,
      receivedAmount: paymentReconciliationExceptions.receivedAmount,
      status: paymentReconciliationExceptions.status,
    })
    .from(paymentReconciliationExceptions)
    .innerJoin(orders, eq(orders.id, paymentReconciliationExceptions.orderId))
    .where(eq(paymentReconciliationExceptions.id, exceptionId))
    .limit(1);

  if (!exception || exception.status !== "open") {
    return {
      notified: 0,
      skipped: true,
      reason: exception ? "exception_resolved" : "exception_not_found",
    } as const;
  }

  const recipientUserIds = await getAdminOrderRecipientIds();
  const data = {
    customer_name: exception.customerName,
    exception_reason: humanize(exception.reason),
    order_id: exception.orderId,
    order_number: exception.orderNumber,
    payment_amount: formatMoney(
      exception.receivedAmount,
      exception.currency,
    ),
    provider_payment_id:
      exception.providerPaymentId ?? "Not supplied",
  };
  const results = await Promise.allSettled(
    recipientUserIds.map(async (recipientUserId) => {
      const claim = await claimNotificationDispatch({
        dedupeKey: `admin-payment-reconciliation:${exception.id}:${recipientUserId}`,
        eventKey: adminPaymentReconciliationEvent,
        payload: {
          exceptionId: exception.id,
          recipientUserId,
        },
      });

      if (!claim.claimed) {
        return { notified: false, reason: claim.reason } as const;
      }

      try {
        const result = await notify({
          data,
          event: adminPaymentReconciliationEvent,
          recipientUserId,
        });

        if (!notificationResultSucceeded(result)) {
          throw new Error(
            "No configured admin notification channel succeeded.",
          );
        }

        await completeNotificationDispatch(
          claim.claimId,
          claim.claimToken,
        );

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
        `Failed to notify admin ${recipientUserIds[index] ?? "unknown"} about payment exception ${exception.id}.`,
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

export async function notifyAdminsOfOpenPaymentReconciliationExceptions(
  limit = 20,
) {
  const rows = await db
    .select({ id: paymentReconciliationExceptions.id })
    .from(paymentReconciliationExceptions)
    .where(eq(paymentReconciliationExceptions.status, "open"))
    .orderBy(asc(paymentReconciliationExceptions.firstSeenAt))
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));

  const results = await Promise.allSettled(
    rows.map((row) =>
      notifyAdminsOfPaymentReconciliationException(row.id),
    ),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        "[payment-reconciliation] admin notification failed",
        result.reason,
      );
    }
  });

  return {
    attempted: rows.length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
