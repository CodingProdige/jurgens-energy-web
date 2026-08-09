import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  auditLogs,
  courierGuyBookingBatchItems,
  courierGuyBookingBatches,
  courierGuyPackingPlans,
  orders,
  shipments,
} from "@/src/db/schema";

const providerCreatedStatuses = [
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "cancelling",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "returned",
  "undeliverable",
  "cancelled",
] as const;

export async function synchronizeCourierGuyBookingBatchAfterReconciliation(
  shipmentId: string,
) {
  const [candidate] = await db
    .select({
      batchId: courierGuyBookingBatchItems.batchId,
      itemId: courierGuyBookingBatchItems.id,
      orderId: courierGuyBookingBatches.orderId,
      packingRevision: courierGuyBookingBatches.packingRevision,
    })
    .from(courierGuyBookingBatchItems)
    .innerJoin(
      courierGuyBookingBatches,
      eq(courierGuyBookingBatches.id, courierGuyBookingBatchItems.batchId),
    )
    .where(
      and(
        eq(courierGuyBookingBatchItems.shipmentId, shipmentId),
        inArray(courierGuyBookingBatchItems.status, [
          "attempting",
          "needs_reconciliation",
        ]),
      ),
    )
    .orderBy(desc(courierGuyBookingBatches.createdAt))
    .limit(1);

  if (!candidate) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, candidate.orderId))
      .limit(1)
      .for("update");
    const [plan] = await tx
      .select({ revision: courierGuyPackingPlans.revision })
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, candidate.orderId))
      .limit(1)
      .for("update");
    const orderShipments = await tx
      .select({
        id: shipments.id,
        providerCostAmount: shipments.providerCostAmount,
        providerShipmentId: shipments.providerShipmentId,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
      })
      .from(shipments)
      .where(
        and(
          eq(shipments.orderId, candidate.orderId),
          eq(shipments.provider, "courier_guy"),
        ),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const [batch] = await tx
      .select({ status: courierGuyBookingBatches.status })
      .from(courierGuyBookingBatches)
      .where(eq(courierGuyBookingBatches.id, candidate.batchId))
      .limit(1)
      .for("update");
    const batchItems = await tx
      .select({
        id: courierGuyBookingBatchItems.id,
        status: courierGuyBookingBatchItems.status,
      })
      .from(courierGuyBookingBatchItems)
      .where(eq(courierGuyBookingBatchItems.batchId, candidate.batchId))
      .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
      .for("update");
    const shipment = orderShipments.find((item) => item.id === shipmentId);
    const item = batchItems.find((entry) => entry.id === candidate.itemId);
    const providerCreated = Boolean(
      shipment &&
        (shipment.providerShipmentId ||
          shipment.trackingNumber ||
          providerCreatedStatuses.includes(
            shipment.status as (typeof providerCreatedStatuses)[number],
          )),
    );

    if (
      !plan ||
      plan.revision !== candidate.packingRevision ||
      !batch ||
      !item ||
      !["attempting", "needs_reconciliation"].includes(item.status) ||
      !providerCreated
    ) {
      return;
    }

    const now = new Date();

    await tx
      .update(courierGuyBookingBatchItems)
      .set({
        completedAt: now,
        lastError: null,
        providerCostAmount: shipment?.providerCostAmount ?? null,
        status: "booked",
        updatedAt: now,
      })
      .where(eq(courierGuyBookingBatchItems.id, candidate.itemId));

    const statuses = batchItems.map((entry) =>
      entry.id === candidate.itemId ? "booked" : entry.status,
    );
    const allBooked =
      statuses.length > 0 && statuses.every((status) => status === "booked");
    const stillNeedsReconciliation = statuses.some(
      (status) => status === "needs_reconciliation",
    );
    const nextBatchStatus = allBooked
      ? "booked"
      : stillNeedsReconciliation
        ? "needs_reconciliation"
        : "partially_booked";
    const nextPlanStatus = allBooked
      ? "booked"
      : stillNeedsReconciliation
        ? "reconciliation_required"
        : "booking";

    await tx
      .update(courierGuyBookingBatches)
      .set({
        completedAt: allBooked ? now : null,
        status: nextBatchStatus,
        updatedAt: now,
      })
      .where(eq(courierGuyBookingBatches.id, candidate.batchId));
    await tx
      .update(courierGuyPackingPlans)
      .set({ status: nextPlanStatus, updatedAt: now })
      .where(
        and(
          eq(courierGuyPackingPlans.orderId, candidate.orderId),
          eq(
            courierGuyPackingPlans.revision,
            candidate.packingRevision,
          ),
        ),
      );
    await tx.insert(auditLogs).values({
      action: "shipping.courier_guy.order_booking_reconciled",
      actorUserId: null,
      entityId: candidate.orderId,
      entityType: "order",
      metadata: JSON.stringify({
        batchId: candidate.batchId,
        nextBatchStatus,
        packingRevision: candidate.packingRevision,
        shipmentId,
      }),
    });
  });
}
