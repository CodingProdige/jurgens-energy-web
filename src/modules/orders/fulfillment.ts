import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orders, shipments } from "@/src/db/schema";
import { resolveAggregatedOrderStatus } from "@/src/modules/orders/fulfillment-status";

type OrderStatus = (typeof orders.$inferSelect)["status"];
type FulfillmentOrderStatus = Extract<OrderStatus, "paid" | "fulfilled">;

export async function reconcileOrderFulfillment(orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");

    if (!order) {
      return {
        changed: false,
        orderId,
        reason: "order_not_found",
        status: null,
      } as const;
    }

    const shipmentRows = await tx
      .select({ status: shipments.status })
      .from(shipments)
      .where(eq(shipments.orderId, orderId));
    const nextStatus = resolveAggregatedOrderStatus({
      orderStatus: order.status,
      shipmentStatuses: shipmentRows.map((shipment) => shipment.status),
    });

    if (nextStatus === order.status) {
      return {
        changed: false,
        orderId,
        reason:
          shipmentRows.length === 0
            ? ("no_shipments" as const)
            : ("already_reconciled" as const),
        status: nextStatus,
      } as const;
    }

    const [updated] = await tx
      .update(orders)
      .set({
        status: nextStatus as FulfillmentOrderStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning({ status: orders.status });

    return {
      changed: Boolean(updated),
      orderId,
      reason: "shipment_statuses_reconciled",
      status: updated?.status ?? order.status,
    } as const;
  });
}

export async function reconcileOutstandingOrderFulfillment(limit = 50) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT candidate.id
    FROM orders AS candidate
    WHERE candidate.status IN ('paid', 'fulfilled')
      AND EXISTS (
        SELECT 1
        FROM shipments
        WHERE shipments.order_id = candidate.id
      )
      AND (
        (
          candidate.status = 'paid'
          AND NOT EXISTS (
            SELECT 1
            FROM shipments
            WHERE shipments.order_id = candidate.id
              AND shipments.status <> 'delivered'
          )
        )
        OR (
          candidate.status = 'fulfilled'
          AND EXISTS (
            SELECT 1
            FROM shipments
            WHERE shipments.order_id = candidate.id
              AND shipments.status <> 'delivered'
          )
        )
      )
    ORDER BY candidate.updated_at ASC
    LIMIT ${Math.max(1, Math.min(250, Math.trunc(limit)))}
  `);

  for (const row of rows) {
    await reconcileOrderFulfillment(row.id);
  }

  return { reconciled: rows.length };
}
