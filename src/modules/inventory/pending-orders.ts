import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/src/db";

export async function expirePendingCheckoutOrders(limit = 25) {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const rows = await db.execute<{ id: string }>(sql`
    WITH candidates AS MATERIALIZED (
      SELECT checkout_order.id
      FROM orders AS checkout_order
      WHERE checkout_order.status = 'pending'
        AND checkout_order.payment_expires_at <= now()
        AND NOT EXISTS (
          SELECT 1
          FROM payments AS completed_payment
          WHERE completed_payment.order_id = checkout_order.id
            AND completed_payment.status IN ('authorized', 'captured', 'refunded')
        )
      ORDER BY checkout_order.payment_expires_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    ),
    released AS (
      UPDATE inventory_reservations AS reservation
      SET status = 'released',
          released_at = now(),
          release_reason = 'expired',
          updated_at = now()
      FROM candidates
      WHERE reservation.order_id = candidates.id
        AND reservation.status = 'reserved'
      RETURNING reservation.variant_id, reservation.stock_quantity
    ),
    restocked AS (
      UPDATE product_variants AS variant
      SET stock_on_hand = variant.stock_on_hand + released_totals.quantity
      FROM (
        SELECT released.variant_id, sum(released.stock_quantity)::integer AS quantity
        FROM released
        GROUP BY released.variant_id
      ) AS released_totals
      WHERE variant.id = released_totals.variant_id
      RETURNING variant.id
    ),
    expired_payments AS (
      UPDATE payments AS payment
      SET status = 'failed',
          provider_status = 'EXPIRED',
          updated_at = now()
      FROM candidates
      WHERE payment.order_id = candidates.id
        AND payment.status = 'pending'
      RETURNING payment.id
    ),
    expired_orders AS (
      UPDATE orders AS checkout_order
      SET status = 'cancelled',
          updated_at = now()
      FROM candidates
      WHERE checkout_order.id = candidates.id
        AND checkout_order.status = 'pending'
      RETURNING checkout_order.id
    )
    SELECT expired_orders.id
    FROM expired_orders
  `);

  return {
    expiredOrderIds: rows.map((row) => row.id),
    processed: rows.length,
  };
}
