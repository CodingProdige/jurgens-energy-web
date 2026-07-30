import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { orderItems, orders } from "@/src/db/schema/orders";
import { productVariants } from "@/src/db/schema/products";
import { paymentRefunds } from "@/src/db/schema/refunds";
import { shipments } from "@/src/db/schema/shipping";

export const inventoryReservationStatuses = [
  "reserved",
  "consumed",
  "released",
] as const;
export type InventoryReservationStatus =
  (typeof inventoryReservationStatuses)[number];

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    stockQuantity: integer("stock_quantity").notNull(),
    status: varchar("status", { length: 24 })
      .$type<InventoryReservationStatus>()
      .notNull()
      .default("reserved"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    releasedAt: timestamp("released_at", { mode: "date" }),
    releaseReason: varchar("release_reason", { length: 80 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (reservation) => ({
    orderVariantUnique: unique(
      "inventory_reservations_order_variant_unique",
    ).on(reservation.orderId, reservation.variantId),
    statusExpiryIdx: index(
      "inventory_reservations_status_expires_idx",
    ).on(reservation.status, reservation.expiresAt),
    variantIdx: index("inventory_reservations_variant_id_idx").on(
      reservation.variantId,
    ),
    quantityPositive: check(
      "inventory_reservations_quantity_positive_check",
      sql`${reservation.quantity} > 0`,
    ),
    stockQuantityValid: check(
      "inventory_reservations_stock_quantity_check",
      sql`${reservation.stockQuantity} >= 0 AND ${reservation.stockQuantity} <= ${reservation.quantity}`,
    ),
    statusValid: check(
      "inventory_reservations_status_check",
      sql`${reservation.status} IN ('reserved', 'consumed', 'released')`,
    ),
  }),
);

export const refundInventoryAdjustments = pgTable(
  "refund_inventory_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => paymentRefunds.id, { onDelete: "restrict" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    appliedAt: timestamp("applied_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (adjustment) => ({
    refundOrderItemUnique: unique(
      "refund_inventory_adjustments_refund_order_item_unique",
    ).on(adjustment.refundId, adjustment.orderItemId),
    refundIdx: index("refund_inventory_adjustments_refund_id_idx").on(
      adjustment.refundId,
    ),
    variantIdx: index("refund_inventory_adjustments_variant_id_idx").on(
      adjustment.variantId,
    ),
    quantityPositive: check(
      "refund_inventory_adjustments_quantity_positive_check",
      sql`${adjustment.quantity} > 0`,
    ),
  }),
);

export const refundShipmentCancellationJobStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
  "manual_review",
] as const;
export type RefundShipmentCancellationJobStatus =
  (typeof refundShipmentCancellationJobStatuses)[number];

export const refundShipmentCancellationJobs = pgTable(
  "refund_shipment_cancellation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => paymentRefunds.id, { onDelete: "restrict" }),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 24 })
      .$type<RefundShipmentCancellationJobStatus>()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (job) => ({
    shipmentUnique: unique(
      "refund_shipment_cancellation_jobs_shipment_unique",
    ).on(job.shipmentId),
    statusAvailableIdx: index(
      "refund_shipment_cancellation_jobs_status_available_idx",
    ).on(job.status, job.availableAt),
    statusValid: check(
      "refund_shipment_cancellation_jobs_status_check",
      sql`${job.status} IN ('pending', 'processing', 'completed', 'failed', 'manual_review')`,
    ),
  }),
);
