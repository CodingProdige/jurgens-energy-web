import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  auditLogs,
  jurgensDeliverySchedules,
  paymentRefunds,
  refundShipmentCancellationJobs,
  shipmentEvents,
  shipments,
} from "@/src/db/schema";
import { reconcileOrderFulfillment } from "@/src/modules/orders/fulfillment";
import {
  enqueueJurgensDeliveryStatusNotification,
  sendJurgensDeliveryStatusNotification,
} from "@/src/modules/orders/jurgens-delivery-notifications";
import { sendCourierGuyShipmentStatusNotification } from "@/src/modules/shipping/courier-guy-notifications";

type CancellationReviewResolution =
  | "confirmed_cancelled"
  | "shipment_not_cancelled";

type ReviewRecord = {
  attempts: number;
  jobStatus: typeof refundShipmentCancellationJobs.$inferSelect.status;
  orderId: string;
  provider: typeof shipments.$inferSelect.provider;
  refundId: string;
  scheduleId: string | null;
  shipmentId: string;
  shipmentStatus: typeof shipments.$inferSelect.status;
  trackingNumber: string | null;
  waybillNumber: string | null;
  waybillUrl: string | null;
};

export class RefundShipmentCancellationReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundShipmentCancellationReviewError";
  }
}

function restoreActiveCourierStatus(record: ReviewRecord) {
  return record.waybillUrl ? ("waybill_ready" as const) : ("booked" as const);
}

async function getLockedReviewRecord({
  jobId,
  orderId,
  transaction,
}: {
  jobId: string;
  orderId: string;
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0];
}) {
  const [candidate] = await transaction
    .select({ orderId: paymentRefunds.orderId })
    .from(refundShipmentCancellationJobs)
    .innerJoin(
      paymentRefunds,
      eq(paymentRefunds.id, refundShipmentCancellationJobs.refundId),
    )
    .where(
      and(
        eq(refundShipmentCancellationJobs.id, jobId),
        eq(paymentRefunds.orderId, orderId),
      ),
    )
    .limit(1);

  if (!candidate) {
    throw new RefundShipmentCancellationReviewError(
      "The cancellation review could not be found for this order.",
    );
  }

  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + candidate.orderId}))`,
  );

  await transaction.execute(
    sql`select ${refundShipmentCancellationJobs.id}
        from ${refundShipmentCancellationJobs}
        where ${refundShipmentCancellationJobs.id} = ${jobId}
        for update`,
  );

  const [record] = await transaction
    .select({
      attempts: refundShipmentCancellationJobs.attempts,
      jobStatus: refundShipmentCancellationJobs.status,
      orderId: paymentRefunds.orderId,
      provider: shipments.provider,
      refundId: paymentRefunds.id,
      scheduleId: jurgensDeliverySchedules.id,
      shipmentId: shipments.id,
      shipmentStatus: shipments.status,
      trackingNumber: shipments.trackingNumber,
      waybillNumber: shipments.waybillNumber,
      waybillUrl: shipments.waybillUrl,
    })
    .from(refundShipmentCancellationJobs)
    .innerJoin(
      paymentRefunds,
      eq(paymentRefunds.id, refundShipmentCancellationJobs.refundId),
    )
    .innerJoin(
      shipments,
      eq(shipments.id, refundShipmentCancellationJobs.shipmentId),
    )
    .leftJoin(
      jurgensDeliverySchedules,
      eq(jurgensDeliverySchedules.shipmentId, shipments.id),
    )
    .where(
      and(
        eq(refundShipmentCancellationJobs.id, jobId),
        eq(paymentRefunds.orderId, orderId),
        eq(shipments.orderId, orderId),
      ),
    )
    .limit(1);

  if (!record) {
    throw new RefundShipmentCancellationReviewError(
      "The cancellation review could not be found for this order.",
    );
  }

  await transaction.execute(
    sql`select ${shipments.id}
        from ${shipments}
        where ${shipments.id} = ${record.shipmentId}
        for update`,
  );

  return record;
}

async function notifyResolvedCancellation(record: ReviewRecord) {
  if (record.provider === "courier_guy") {
    await sendCourierGuyShipmentStatusNotification(record.shipmentId);
    return;
  }

  if (record.provider === "jurgens_local" && record.scheduleId) {
    await sendJurgensDeliveryStatusNotification({
      force: true,
      scheduleId: record.scheduleId,
    });
  }
}

export async function resolveRefundShipmentCancellationReview({
  actorUserId,
  jobId,
  orderId,
  resolution,
  verificationNote,
}: {
  actorUserId: string;
  jobId: string;
  orderId: string;
  resolution: CancellationReviewResolution;
  verificationNote: string;
}) {
  const now = new Date();
  const result = await db.transaction(async (transaction) => {
    const record = await getLockedReviewRecord({
      jobId,
      orderId,
      transaction,
    });

    if (record.jobStatus === "completed") {
      return {
        alreadyResolved: true,
        record,
        resolution,
      };
    }

    if (record.jobStatus !== "manual_review") {
      throw new RefundShipmentCancellationReviewError(
        "Only a cancellation flagged for manual review can be resolved here.",
      );
    }

    let nextShipmentStatus = record.shipmentStatus;

    if (resolution === "confirmed_cancelled") {
      if (
        record.shipmentStatus === "delivered" ||
        record.shipmentStatus === "returned"
      ) {
        throw new RefundShipmentCancellationReviewError(
          "A delivered or returned shipment cannot be overwritten as cancelled. Resolve it as not cancelled after checking the physical outcome.",
        );
      }

      nextShipmentStatus = "cancelled";

      await transaction
        .update(shipments)
        .set({
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(shipments.id, record.shipmentId));

      if (record.provider === "jurgens_local") {
        const updatedSchedules = await transaction
          .update(jurgensDeliverySchedules)
          .set({
            lastNotifiedStatus: null,
            status: "cancelled",
            updatedAt: now,
          })
          .where(eq(jurgensDeliverySchedules.shipmentId, record.shipmentId))
          .returning({
            orderId: jurgensDeliverySchedules.orderId,
            scheduleId: jurgensDeliverySchedules.id,
            status: jurgensDeliverySchedules.status,
          });

        for (const schedule of updatedSchedules) {
          await enqueueJurgensDeliveryStatusNotification({
            ...schedule,
            revision: now.toISOString(),
            transaction,
          });
        }
      }
    } else {
      if (record.shipmentStatus === "cancelled") {
        throw new RefundShipmentCancellationReviewError(
          "This shipment is already cancelled. Resolve the review using the confirmed-cancelled outcome.",
        );
      }

      if (
        record.provider === "courier_guy" &&
        record.shipmentStatus === "cancelling"
      ) {
        nextShipmentStatus = restoreActiveCourierStatus(record);

        await transaction
          .update(shipments)
          .set({
            status: nextShipmentStatus,
            updatedAt: now,
          })
          .where(eq(shipments.id, record.shipmentId));
      }
    }

    await transaction
      .update(refundShipmentCancellationJobs)
      .set({
        completedAt: now,
        lastError: null,
        lockedAt: null,
        status: "completed",
        updatedAt: now,
      })
      .where(
        and(
          eq(refundShipmentCancellationJobs.id, jobId),
          eq(refundShipmentCancellationJobs.status, "manual_review"),
        ),
      );

    await transaction
      .insert(shipmentEvents)
      .values({
        message:
          resolution === "confirmed_cancelled"
            ? "Refund cancellation review resolved after the provider confirmed cancellation."
            : "Refund cancellation review resolved after verification that the shipment was not cancelled.",
        occurredAt: now,
        payload: {
          actorUserId,
          jobId,
          refundId: record.refundId,
          resolution,
          verificationNote,
        },
        provider: record.provider,
        providerEventId: `refund-cancellation-review:${jobId}:${resolution}`,
        shipmentId: record.shipmentId,
        status: "refund_cancellation_review_resolved",
      })
      .onConflictDoNothing();

    await transaction.insert(auditLogs).values({
      action: "refund.shipment_cancellation_review_resolved",
      actorUserId,
      entityId: jobId,
      entityType: "refund_shipment_cancellation_job",
      metadata: JSON.stringify({
        orderId,
        provider: record.provider,
        refundId: record.refundId,
        resolution,
        shipmentId: record.shipmentId,
        shipmentStatusAfter: nextShipmentStatus,
        shipmentStatusBefore: record.shipmentStatus,
        trackingReference:
          record.trackingNumber ?? record.waybillNumber ?? null,
        verificationNote,
      }),
    });

    return {
      alreadyResolved: false,
      record: {
        ...record,
        shipmentStatus: nextShipmentStatus,
      },
      resolution,
    };
  });

  await reconcileOrderFulfillment(orderId);

  if (
    !result.alreadyResolved &&
    result.resolution === "confirmed_cancelled"
  ) {
    await notifyResolvedCancellation(result.record).catch((error) => {
      console.error(
        "[refund-fulfillment] Cancellation resolution notification failed",
        error,
      );
    });
  }

  return {
    alreadyResolved: result.alreadyResolved,
    shipmentStatus: result.record.shipmentStatus,
  };
}

export async function retryRefundShipmentCancellationAfterVerification({
  actorUserId,
  jobId,
  orderId,
  verificationNote,
}: {
  actorUserId: string;
  jobId: string;
  orderId: string;
  verificationNote: string;
}) {
  const now = new Date();
  const result = await db.transaction(async (transaction) => {
    const record = await getLockedReviewRecord({
      jobId,
      orderId,
      transaction,
    });

    if (record.jobStatus !== "manual_review") {
      throw new RefundShipmentCancellationReviewError(
        "Only a cancellation flagged for manual review can be retried.",
      );
    }

    if (record.provider !== "courier_guy") {
      throw new RefundShipmentCancellationReviewError(
        "Local delivery cancellations must be resolved after a physical check; they are not sent to an external provider.",
      );
    }

    if (
      record.shipmentStatus !== "booked" &&
      record.shipmentStatus !== "waybill_ready" &&
      record.shipmentStatus !== "cancelling"
    ) {
      throw new RefundShipmentCancellationReviewError(
        "This shipment is no longer safely eligible for a cancellation retry. Refresh tracking and resolve the review using the verified outcome.",
      );
    }

    const nextShipmentStatus =
      record.shipmentStatus === "cancelling"
        ? restoreActiveCourierStatus(record)
        : record.shipmentStatus;

    if (nextShipmentStatus !== record.shipmentStatus) {
      await transaction
        .update(shipments)
        .set({
          status: nextShipmentStatus,
          updatedAt: now,
        })
        .where(eq(shipments.id, record.shipmentId));
    }

    const [queued] = await transaction
      .update(refundShipmentCancellationJobs)
      .set({
        attempts: Math.max(record.attempts, 4),
        availableAt: now,
        completedAt: null,
        lastError: null,
        lockedAt: null,
        status: "pending",
        updatedAt: now,
      })
      .where(
        and(
          eq(refundShipmentCancellationJobs.id, jobId),
          eq(refundShipmentCancellationJobs.status, "manual_review"),
        ),
      )
      .returning({ id: refundShipmentCancellationJobs.id });

    if (!queued) {
      throw new RefundShipmentCancellationReviewError(
        "The cancellation review changed before the retry could be queued.",
      );
    }

    await transaction
      .insert(shipmentEvents)
      .values({
        message:
          "A single Courier Guy cancellation retry was queued after an administrator verified the earlier request was not accepted.",
        occurredAt: now,
        payload: {
          actorUserId,
          jobId,
          refundId: record.refundId,
          verificationNote,
        },
        provider: record.provider,
        providerEventId: `refund-cancellation-retry:${jobId}:${record.attempts + 1}`,
        shipmentId: record.shipmentId,
        status: "refund_cancellation_retry_queued",
      })
      .onConflictDoNothing();

    await transaction.insert(auditLogs).values({
      action: "refund.shipment_cancellation_retry_queued",
      actorUserId,
      entityId: jobId,
      entityType: "refund_shipment_cancellation_job",
      metadata: JSON.stringify({
        acknowledgedProviderOutcome: true,
        orderId,
        previousAttempts: record.attempts,
        provider: record.provider,
        refundId: record.refundId,
        shipmentId: record.shipmentId,
        shipmentStatusAfter: nextShipmentStatus,
        shipmentStatusBefore: record.shipmentStatus,
        trackingReference:
          record.trackingNumber ?? record.waybillNumber ?? null,
        verificationNote,
      }),
    });

    return {
      shipmentStatus: nextShipmentStatus,
    };
  });

  await reconcileOrderFulfillment(orderId);

  return result;
}
