import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { orders } from "@/src/db/schema/orders";

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const payfastItnEventStatus = pgEnum("payfast_itn_event_status", [
  "received",
  "processed",
  "rejected",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    providerStatus: varchar("provider_status", { length: 80 }),
    status: paymentStatus("status").notNull().default("pending"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (payment) => ({
    providerPaymentUnique: unique("payments_provider_payment_id_unique").on(
      payment.provider,
      payment.providerPaymentId,
    ),
  }),
);

export const payfastItnEvents = pgTable(
  "payfast_itn_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentReference: varchar("payment_reference", { length: 160 }),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    providerStatus: varchar("provider_status", { length: 80 }),
    sourceIp: varchar("source_ip", { length: 64 }),
    cfConnectingIp: varchar("cf_connecting_ip", { length: 64 }),
    xForwardedFor: varchar("x_forwarded_for", { length: 1024 }),
    status: payfastItnEventStatus("status").notNull().default("received"),
    validationStage: varchar("validation_stage", { length: 80 }),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (event) => ({
    paymentReferenceIdx: index(
      "payfast_itn_events_payment_reference_idx",
    ).on(event.paymentReference),
    receivedAtIdx: index("payfast_itn_events_received_at_idx").on(
      event.receivedAt,
    ),
    statusReceivedAtIdx: index(
      "payfast_itn_events_status_received_at_idx",
    ).on(event.status, event.receivedAt),
  }),
);
