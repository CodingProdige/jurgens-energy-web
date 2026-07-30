import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  auditLogs,
  jurgensDeliverySchedules,
  orders,
  payments,
  shipments,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";
import { reconcileOrderFulfillment } from "@/src/modules/orders/fulfillment";
import {
  enqueueJurgensDeliveryStatusNotification,
  sendJurgensDeliveryStatusNotification,
} from "@/src/modules/orders/jurgens-delivery-notifications";
import {
  canEditJurgensDeliveryPlan,
  canTransitionJurgensDeliveryStatus,
  getJurgensLocalShipmentUpdate,
} from "@/src/modules/orders/jurgens-delivery-workflow";

export type JurgensDeliveryNotificationAttempt = {
  delivered: boolean;
  message: string;
};

export type SaveJurgensDeliveryPlanInput = {
  actorUserId: string;
  deliveryInstructions: string | null;
  scheduledDate: string;
  shipmentId: string;
  windowEnd: string | null;
  windowLabel: string | null;
  windowStart: string | null;
};

async function requireCapturedOrderPayment(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orderId: string,
  orderStatus: typeof orders.$inferSelect.status,
) {
  const [capturedPayment] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(eq(payments.orderId, orderId), eq(payments.status, "captured")),
    )
    .limit(1);

  if (
    !capturedPayment ||
    (orderStatus !== "paid" && orderStatus !== "fulfilled")
  ) {
    throw new Error(
      "Payment must be captured before this local delivery can be managed.",
    );
  }
}

async function notifySchedule({
  force = false,
  orderId,
  revision,
  scheduleId,
  status,
}: {
  force?: boolean;
  orderId?: string;
  revision?: string;
  scheduleId: string;
  status?: JurgensDeliveryScheduleStatus;
}): Promise<JurgensDeliveryNotificationAttempt> {
  try {
    const result = await sendJurgensDeliveryStatusNotification({
      expectedStatus: status,
      force,
      notificationRevision: revision,
      orderId,
      scheduleId,
    });
    const reason = "reason" in result ? result.reason : null;

    if (result.ok || reason === "in_progress") {
      return {
        delivered: true,
        message:
          reason === "in_progress"
            ? "The customer update is already being sent."
            : "The customer update was sent.",
      };
    }

    if (reason === "superseded") {
      return {
        delivered: true,
        message:
          "A newer delivery status replaced this customer update.",
      };
    }

    return {
      delivered: false,
      message:
        "The customer update was not delivered. Use Retry customer update once notification delivery is available.",
    };
  } catch (error) {
    console.error(
      "[jurgens-local-delivery] Customer notification failed",
      error,
    );

    return {
      delivered: false,
      message:
        "The customer update failed and remains available to retry.",
    };
  }
}

export async function saveJurgensDeliveryPlan(
  input: SaveJurgensDeliveryPlanInput,
) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [shipmentCandidate] = await tx
      .select({
        orderId: shipments.orderId,
        provider: shipments.provider,
      })
      .from(shipments)
      .where(eq(shipments.id, input.shipmentId))
      .limit(1);

    if (
      !shipmentCandidate ||
      shipmentCandidate.provider !== "jurgens_local"
    ) {
      throw new Error("The Jurgens local shipment could not be found.");
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + shipmentCandidate.orderId}))`,
    );

    const [shipment] = await tx
      .select({
        bookedAt: shipments.bookedAt,
        collectedAt: shipments.collectedAt,
        deliveredAt: shipments.deliveredAt,
        orderId: shipments.orderId,
        orderStatus: orders.status,
        provider: shipments.provider,
        quoteId: shipments.quoteId,
      })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(eq(shipments.id, input.shipmentId))
      .limit(1)
      .for("update");

    if (!shipment || shipment.provider !== "jurgens_local") {
      throw new Error("The Jurgens local shipment could not be found.");
    }

    await requireCapturedOrderPayment(
      tx,
      shipment.orderId,
      shipment.orderStatus,
    );

    const [existing] = await tx
      .select()
      .from(jurgensDeliverySchedules)
      .where(
        or(
          eq(jurgensDeliverySchedules.shipmentId, input.shipmentId),
          eq(jurgensDeliverySchedules.orderId, shipment.orderId),
        ),
      )
      .limit(1)
      .for("update");

    if (existing && !canEditJurgensDeliveryPlan(existing.status)) {
      if (existing.status === "out_for_delivery") {
        throw new Error(
          "Mark this delivery as missed before assigning a new delivery date.",
        );
      }

      throw new Error(
        `A ${existing.status.replaceAll("_", " ")} delivery can no longer be rescheduled.`,
      );
    }

    const dateChanged =
      Boolean(existing) && existing.scheduledDate !== input.scheduledDate;
    const nextStatus: JurgensDeliveryScheduleStatus = !existing
      ? "scheduled"
      : existing.status === "missed" || dateChanged
        ? "rescheduled"
        : existing.status;
    const planChanged =
      !existing ||
      existing.shipmentId !== input.shipmentId ||
      existing.scheduledDate !== input.scheduledDate ||
      existing.windowStart !== input.windowStart ||
      existing.windowEnd !== input.windowEnd ||
      existing.windowLabel !== input.windowLabel ||
      existing.deliveryInstructions !== input.deliveryInstructions ||
      existing.status !== nextStatus;

    if (!planChanged && existing) {
      return {
        changed: false,
        orderId: shipment.orderId,
        scheduleId: existing.id,
        status: existing.status,
      };
    }

    let scheduleId: string;

    if (existing) {
      const [updated] = await tx
        .update(jurgensDeliverySchedules)
        .set({
          deliveryInstructions: input.deliveryInstructions,
          lastNotifiedStatus: null,
          scheduledDate: input.scheduledDate,
          shipmentId: input.shipmentId,
          status: nextStatus,
          updatedAt: now,
          windowEnd: input.windowEnd,
          windowLabel: input.windowLabel,
          windowStart: input.windowStart,
        })
        .where(
          and(
            eq(jurgensDeliverySchedules.id, existing.id),
            eq(jurgensDeliverySchedules.status, existing.status),
          ),
        )
        .returning({ id: jurgensDeliverySchedules.id });

      if (!updated) {
        throw new Error("The delivery plan could not be updated.");
      }

      scheduleId = updated.id;
    } else {
      const [created] = await tx
        .insert(jurgensDeliverySchedules)
        .values({
          deliveryInstructions: input.deliveryInstructions,
          orderId: shipment.orderId,
          quoteId: shipment.quoteId,
          scheduledDate: input.scheduledDate,
          shipmentId: input.shipmentId,
          status: nextStatus,
          updatedAt: now,
          windowEnd: input.windowEnd,
          windowLabel: input.windowLabel,
          windowStart: input.windowStart,
        })
        .returning({ id: jurgensDeliverySchedules.id });

      if (!created) {
        throw new Error("The delivery plan could not be created.");
      }

      scheduleId = created.id;
    }

    await tx
      .update(shipments)
      .set({
        ...getJurgensLocalShipmentUpdate({
          current: shipment,
          now,
          status: nextStatus,
        }),
        updatedAt: now,
      })
      .where(eq(shipments.id, input.shipmentId));

    await tx.insert(auditLogs).values({
      action: existing
        ? "orders.jurgens_delivery.plan_updated"
        : "orders.jurgens_delivery.scheduled",
      actorUserId: input.actorUserId,
      entityId: scheduleId,
      entityType: "jurgens_delivery_schedule",
      metadata: JSON.stringify({
        deliveryInstructions: input.deliveryInstructions,
        orderId: shipment.orderId,
        previousStatus: existing?.status ?? null,
        scheduledDate: input.scheduledDate,
        shipmentId: input.shipmentId,
        status: nextStatus,
        windowEnd: input.windowEnd,
        windowLabel: input.windowLabel,
        windowStart: input.windowStart,
      }),
    });

    const notificationRevision = now.toISOString();

    await enqueueJurgensDeliveryStatusNotification({
      orderId: shipment.orderId,
      revision: notificationRevision,
      scheduleId,
      status: nextStatus,
      transaction: tx,
    });

    return {
      changed: true,
      notificationRevision,
      orderId: shipment.orderId,
      scheduleId,
      status: nextStatus,
    };
  });

  if (!result.changed) {
    return {
      ...result,
      notification: null,
    };
  }

  await reconcileOrderFulfillment(result.orderId);
  const notification = await notifySchedule({
    orderId: result.orderId,
    revision: result.notificationRevision,
    scheduleId: result.scheduleId,
    status: result.status,
  });

  return {
    ...result,
    notification,
  };
}

export async function updateJurgensDeliveryStatus({
  actorUserId,
  scheduleId,
  status,
}: {
  actorUserId: string;
  scheduleId: string;
  status: JurgensDeliveryScheduleStatus;
}) {
  if (status === "scheduled" || status === "rescheduled") {
    throw new Error(
      "Use the delivery plan action when scheduling or rescheduling a delivery.",
    );
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [scheduleCandidate] = await tx
      .select({ orderId: jurgensDeliverySchedules.orderId })
      .from(jurgensDeliverySchedules)
      .where(eq(jurgensDeliverySchedules.id, scheduleId))
      .limit(1);

    if (!scheduleCandidate) {
      throw new Error("The local delivery schedule could not be found.");
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + scheduleCandidate.orderId}))`,
    );

    const [schedule] = await tx
      .select({
        orderId: jurgensDeliverySchedules.orderId,
        orderStatus: orders.status,
        shipmentId: jurgensDeliverySchedules.shipmentId,
        status: jurgensDeliverySchedules.status,
      })
      .from(jurgensDeliverySchedules)
      .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
      .where(eq(jurgensDeliverySchedules.id, scheduleId))
      .limit(1)
      .for("update");

    if (!schedule) {
      throw new Error("The local delivery schedule could not be found.");
    }

    if (
      !canTransitionJurgensDeliveryStatus({
        from: schedule.status,
        to: status,
      })
    ) {
      throw new Error(
        `A ${schedule.status.replaceAll("_", " ")} delivery cannot move directly to ${status.replaceAll("_", " ")}.`,
      );
    }

    await requireCapturedOrderPayment(
      tx,
      schedule.orderId,
      schedule.orderStatus,
    );

    const [shipment] = await tx
      .select({
        bookedAt: shipments.bookedAt,
        collectedAt: shipments.collectedAt,
        deliveredAt: shipments.deliveredAt,
        id: shipments.id,
      })
      .from(shipments)
      .where(
        schedule.shipmentId
          ? and(
              eq(shipments.id, schedule.shipmentId),
              eq(shipments.provider, "jurgens_local"),
            )
          : and(
              eq(shipments.orderId, schedule.orderId),
              eq(shipments.provider, "jurgens_local"),
            ),
      )
      .limit(1)
      .for("update");

    if (!shipment) {
      throw new Error(
        "The paid Jurgens shipment is missing. Refresh the order before progressing delivery.",
      );
    }

    const [updatedSchedule] = await tx
      .update(jurgensDeliverySchedules)
      .set({
        lastNotifiedStatus: null,
        shipmentId: shipment.id,
        status,
        updatedAt: now,
      })
      .where(
        and(
          eq(jurgensDeliverySchedules.id, scheduleId),
          eq(jurgensDeliverySchedules.status, schedule.status),
        ),
      )
      .returning({ id: jurgensDeliverySchedules.id });

    if (!updatedSchedule) {
      throw new Error(
        "The delivery changed while it was being updated. Refresh and try again.",
      );
    }

    await tx
      .update(shipments)
      .set({
        ...getJurgensLocalShipmentUpdate({
          current: shipment,
          now,
          status,
        }),
        updatedAt: now,
      })
      .where(eq(shipments.id, shipment.id));

    await tx.insert(auditLogs).values({
      action: "orders.jurgens_delivery.status_updated",
      actorUserId,
      entityId: scheduleId,
      entityType: "jurgens_delivery_schedule",
      metadata: JSON.stringify({
        orderId: schedule.orderId,
        previousStatus: schedule.status,
        shipmentId: shipment.id,
        status,
      }),
    });

    const notificationRevision = now.toISOString();

    await enqueueJurgensDeliveryStatusNotification({
      orderId: schedule.orderId,
      revision: notificationRevision,
      scheduleId,
      status,
      transaction: tx,
    });

    return {
      notificationRevision,
      orderId: schedule.orderId,
      scheduleId,
      status,
    };
  });

  await reconcileOrderFulfillment(result.orderId);
  const notification = await notifySchedule({
    orderId: result.orderId,
    revision: result.notificationRevision,
    scheduleId,
    status: result.status,
  });

  return {
    ...result,
    notification,
  };
}

export async function retryJurgensDeliveryNotification({
  actorUserId,
  scheduleId,
}: {
  actorUserId: string;
  scheduleId: string;
}) {
  const retry = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ orderId: jurgensDeliverySchedules.orderId })
      .from(jurgensDeliverySchedules)
      .where(eq(jurgensDeliverySchedules.id, scheduleId))
      .limit(1);

    if (!candidate) {
      throw new Error("The local delivery schedule could not be found.");
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"jurgens-delivery:" + candidate.orderId}))`,
    );

    const [schedule] = await tx
      .select({
        orderId: jurgensDeliverySchedules.orderId,
        status: jurgensDeliverySchedules.status,
        updatedAt: jurgensDeliverySchedules.updatedAt,
      })
      .from(jurgensDeliverySchedules)
      .where(eq(jurgensDeliverySchedules.id, scheduleId))
      .limit(1)
      .for("update");

    if (!schedule) {
      throw new Error("The local delivery schedule could not be found.");
    }

    const revisionDate = new Date(
      Math.max(Date.now(), schedule.updatedAt.getTime() + 1),
    );
    const [updated] = await tx
      .update(jurgensDeliverySchedules)
      .set({
        lastNotifiedStatus: null,
        updatedAt: revisionDate,
      })
      .where(
        and(
          eq(jurgensDeliverySchedules.id, scheduleId),
          eq(jurgensDeliverySchedules.status, schedule.status),
          eq(jurgensDeliverySchedules.updatedAt, schedule.updatedAt),
        ),
      )
      .returning({ id: jurgensDeliverySchedules.id });

    if (!updated) {
      throw new Error(
        "The delivery changed before its customer update could be queued.",
      );
    }

    const revision = revisionDate.toISOString();

    await enqueueJurgensDeliveryStatusNotification({
      orderId: schedule.orderId,
      revision,
      scheduleId,
      status: schedule.status,
      transaction: tx,
    });

    return {
      orderId: schedule.orderId,
      revision,
      status: schedule.status,
    };
  });
  const notification = await notifySchedule({
    force: true,
    orderId: retry.orderId,
    revision: retry.revision,
    scheduleId,
    status: retry.status,
  });

  await db.insert(auditLogs).values({
    action: "orders.jurgens_delivery.notification_retried",
    actorUserId,
    entityId: scheduleId,
    entityType: "jurgens_delivery_schedule",
    metadata: JSON.stringify({
      delivered: notification.delivered,
      notificationRevision: retry.revision,
      orderId: retry.orderId,
      status: retry.status,
    }),
  });

  return notification;
}
