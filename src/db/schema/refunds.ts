import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  creditNotes,
  invoiceLines,
  invoices,
} from "@/src/db/schema/invoices";
import { orders } from "@/src/db/schema/orders";
import { payments } from "@/src/db/schema/payments";
import { users } from "@/src/db/schema/users";

export const paymentRefundStatuses = [
  "pending",
  "manual_required",
  "submitted",
  "verification_required",
  "completed",
  "failed",
] as const;

export type PaymentRefundStatus = (typeof paymentRefundStatuses)[number];

export const paymentRefundMethods = [
  "payment_source",
  "bank_payout",
  "not_available",
  "unknown",
] as const;

export type PaymentRefundMethod = (typeof paymentRefundMethods)[number];

export type PaymentRefundRequestedAllocation = Readonly<{
  grossAmountCents: number;
  invoiceLineId: string;
  quantity: number;
}>;

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    creditNoteId: uuid("credit_note_id").references(() => creditNotes.id, {
      onDelete: "restrict",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    requestFingerprint: varchar("request_fingerprint", { length: 64 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull().default("payfast"),
    providerPaymentId: varchar("provider_payment_id", {
      length: 160,
    }).notNull(),
    refundKind: varchar("refund_kind", { length: 16 })
      .$type<"full" | "partial">()
      .notNull(),
    refundMethod: varchar("refund_method", { length: 32 })
      .$type<PaymentRefundMethod>()
      .notNull()
      .default("unknown"),
    status: varchar("status", { length: 32 })
      .$type<PaymentRefundStatus>()
      .notNull()
      .default("pending"),
    currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    notifyBuyer: boolean("notify_buyer").notNull().default(true),
    notifyMerchant: boolean("notify_merchant").notNull().default(false),
    requestedAllocations: jsonb("requested_allocations")
      .$type<PaymentRefundRequestedAllocation[]>()
      .notNull(),
    providerAvailableBeforeCents: integer("provider_available_before_cents"),
    providerAvailableAfterCents: integer("provider_available_after_cents"),
    providerStatus: varchar("provider_status", { length: 120 }),
    providerQueryResponse: jsonb("provider_query_response"),
    providerCreateResponse: jsonb("provider_create_response"),
    providerRetrieveResponse: jsonb("provider_retrieve_response"),
    providerHttpStatus: integer("provider_http_status"),
    providerRequestStartedAt: timestamp("provider_request_started_at", {
      mode: "date",
    }),
    manualActionReason: text("manual_action_reason"),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: text("error_message"),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (refund) => ({
    creditNoteUnique: unique("payment_refunds_credit_note_id_unique").on(
      refund.creditNoteId,
    ),
    idempotencyUnique: unique("payment_refunds_idempotency_key_unique").on(
      refund.idempotencyKey,
    ),
    orderIdx: index("payment_refunds_order_id_idx").on(refund.orderId),
    paymentStatusIdx: index("payment_refunds_payment_status_idx").on(
      refund.paymentId,
      refund.status,
    ),
  }),
);

export const paymentRefundAllocations = pgTable(
  "payment_refund_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => paymentRefunds.id, { onDelete: "cascade" }),
    invoiceLineId: uuid("invoice_line_id")
      .notNull()
      .references(() => invoiceLines.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
    grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (allocation) => ({
    refundInvoiceLineUnique: unique(
      "payment_refund_allocations_refund_invoice_line_unique",
    ).on(allocation.refundId, allocation.invoiceLineId),
    refundIdx: index("payment_refund_allocations_refund_id_idx").on(
      allocation.refundId,
    ),
    invoiceLineIdx: index(
      "payment_refund_allocations_invoice_line_id_idx",
    ).on(allocation.invoiceLineId),
  }),
);
