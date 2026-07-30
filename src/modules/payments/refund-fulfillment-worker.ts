import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  refundShipmentCancellationJobs,
  shipmentEvents,
  shipments,
} from "@/src/db/schema";
import { enqueueJurgensDeliveryStatusNotification } from "@/src/modules/orders/jurgens-delivery-notifications";
import { cancelBookedCourierGuyShipment } from "@/src/modules/shipping/courier-guy-shipments";

const MAX_JOBS_PER_PASS = 5;
const MAX_SAFE_RETRIES = 5;

type ClaimedCancellationJob = Readonly<{
  attempts: number;
  id: string;
  shipmentId: string;
}>;

function retryDelay(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));

  return new Date(Date.now() + minutes * 60_000);
}

async function releaseStaleCancellationJobs() {
  await db.execute(sql`
    UPDATE refund_shipment_cancellation_jobs
    SET status = 'manual_review',
        locked_at = NULL,
        last_error = 'The worker stopped during cancellation. Confirm the shipment with the delivery provider before taking another action.',
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at < now() - interval '15 minutes'
  `);
}

async function claimNextCancellationJob(): Promise<ClaimedCancellationJob | null> {
  const rows = await db.execute<{
    attempts: number;
    id: string;
    shipment_id: string;
  }>(sql`
    WITH candidate AS (
      SELECT id
      FROM refund_shipment_cancellation_jobs
      WHERE status IN ('pending', 'failed')
        AND available_at <= now()
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE refund_shipment_cancellation_jobs AS job
    SET status = 'processing',
        attempts = job.attempts + 1,
        locked_at = now(),
        last_error = NULL,
        updated_at = now()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.shipment_id, job.attempts
  `);
  const row = rows[0];

  return row
    ? {
        attempts: row.attempts,
        id: row.id,
        shipmentId: row.shipment_id,
      }
    : null;
}

async function completeCancellationJob(jobId: string) {
  const now = new Date();

  await db
    .update(refundShipmentCancellationJobs)
    .set({
      completedAt: now,
      lastError: null,
      lockedAt: null,
      status: "completed",
      updatedAt: now,
    })
    .where(eq(refundShipmentCancellationJobs.id, jobId));
}

async function requireManualReview(jobId: string, message: string) {
  await db
    .update(refundShipmentCancellationJobs)
    .set({
      lastError: message.slice(0, 2_000),
      lockedAt: null,
      status: "manual_review",
      updatedAt: new Date(),
    })
    .where(eq(refundShipmentCancellationJobs.id, jobId));
}

async function failCancellationJob(
  job: ClaimedCancellationJob,
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message.slice(0, 2_000)
      : "Shipment cancellation failed.";

  if (job.attempts >= MAX_SAFE_RETRIES) {
    await requireManualReview(job.id, message);
    return;
  }

  await db
    .update(refundShipmentCancellationJobs)
    .set({
      availableAt: retryDelay(job.attempts),
      lastError: message,
      lockedAt: null,
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(refundShipmentCancellationJobs.id, job.id));
}

async function cancelInternalShipment({
  jobId,
  provider,
  shipmentId,
}: {
  jobId: string;
  provider: "courier_guy" | "jurgens_local";
  shipmentId: string;
}) {
  const now = new Date();

  await db.transaction(async (transaction) => {
    const [shipmentCandidate] = await transaction
      .select({ orderId: shipments.orderId })
      .from(shipments)
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.provider, provider),
        ),
      )
      .limit(1);

    if (!shipmentCandidate) {
      throw new Error("The shipment could not be found for cancellation.");
    }

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + shipmentCandidate.orderId}))`,
    );

    const [cancelled] = await transaction
      .update(shipments)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.provider, provider),
          eq(shipments.status, "pending_booking"),
        ),
      )
      .returning({ id: shipments.id });

    if (!cancelled) {
      throw new Error(
        "The shipment changed before its unbooked cancellation could complete.",
      );
    }

    if (provider === "jurgens_local") {
      const updatedSchedules = await transaction
        .update(jurgensDeliverySchedules)
        .set({
          lastNotifiedStatus: null,
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(jurgensDeliverySchedules.shipmentId, shipmentId))
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

    await transaction
      .insert(shipmentEvents)
      .values({
        message: "Shipment cancelled after the completed refund.",
        occurredAt: now,
        provider,
        providerEventId: `refund-cancelled:${jobId}`,
        shipmentId,
        status: "cancelled",
      })
      .onConflictDoNothing();
  });
}

async function processClaimedCancellationJob(job: ClaimedCancellationJob) {
  const [shipment] = await db
    .select({
      provider: shipments.provider,
      status: shipments.status,
    })
    .from(shipments)
    .where(eq(shipments.id, job.shipmentId))
    .limit(1);

  if (!shipment || shipment.status === "cancelled") {
    await completeCancellationJob(job.id);
    return;
  }

  if (
    shipment.provider === "courier_guy" &&
    shipment.status === "pending_booking"
  ) {
    await cancelInternalShipment({
      jobId: job.id,
      provider: "courier_guy",
      shipmentId: job.shipmentId,
    });
    await completeCancellationJob(job.id);
    return;
  }

  if (
    shipment.provider === "jurgens_local" &&
    shipment.status === "pending_booking"
  ) {
    await cancelInternalShipment({
      jobId: job.id,
      provider: "jurgens_local",
      shipmentId: job.shipmentId,
    });
    await completeCancellationJob(job.id);
    return;
  }

  if (
    shipment.provider === "courier_guy" &&
    (shipment.status === "booked" || shipment.status === "waybill_ready")
  ) {
    try {
      await cancelBookedCourierGuyShipment(job.shipmentId);
      await completeCancellationJob(job.id);
    } catch (error) {
      const [current] = await db
        .select({ status: shipments.status })
        .from(shipments)
        .where(eq(shipments.id, job.shipmentId))
        .limit(1);

      if (current?.status === "cancelled") {
        await completeCancellationJob(job.id);
      } else if (current?.status === "cancelling") {
        await requireManualReview(
          job.id,
          "The Courier Guy cancellation may have been accepted. Refresh tracking and confirm the provider outcome before retrying.",
        );
      } else {
        await failCancellationJob(job, error);
      }
    }

    return;
  }

  await requireManualReview(
    job.id,
    `Shipment status ${shipment.status} with provider ${shipment.provider} cannot be cancelled automatically. Confirm its physical handover or return before changing inventory.`,
  );
}

export async function processRefundShipmentCancellationJobs(
  limit = MAX_JOBS_PER_PASS,
) {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 25));

  await releaseStaleCancellationJobs();

  let processed = 0;

  while (processed < boundedLimit) {
    const job = await claimNextCancellationJob();

    if (!job) {
      break;
    }

    try {
      await processClaimedCancellationJob(job);
    } catch (error) {
      await failCancellationJob(job, error);
    }

    processed += 1;
  }

  return { processed };
}
