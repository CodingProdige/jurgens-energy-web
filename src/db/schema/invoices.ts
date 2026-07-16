import {
  bigint,
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

import { orderItems, orders } from "@/src/db/schema/orders";
import { users } from "@/src/db/schema/users";

export type InvoiceAddressSnapshot = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  countryCode: string;
  postalCode: string;
  province: string;
  suburb: string | null;
};

export type InvoiceIssuerSnapshot = InvoiceAddressSnapshot & {
  companyRegistrationNumber: string | null;
  email: string;
  legalName: string;
  phone: string;
  tradingName: string;
  vatRegistrationNumber: string;
};

export type InvoiceCustomerSnapshot = InvoiceAddressSnapshot & {
  businessName: string | null;
  email: string;
  name: string;
  phone: string;
  vatRegistrationNumber: string | null;
};

export const creditNoteDeliveryChannels = ["email", "whatsapp"] as const;
export type CreditNoteDeliveryChannel =
  (typeof creditNoteDeliveryChannels)[number];

export const creditNoteDeliveryAttemptStatuses = [
  "pending",
  "sending",
  "verification_required",
  "sent",
  "skipped",
  "failed",
] as const;
export type CreditNoteDeliveryAttemptStatus =
  (typeof creditNoteDeliveryAttemptStatuses)[number];

export const businessInformation = pgTable("business_information", {
  id: integer("id").primaryKey().default(1),
  legalName: varchar("legal_name", { length: 200 }).notNull().default(""),
  tradingName: varchar("trading_name", { length: 200 })
    .notNull()
    .default("Jurgens Energy"),
  companyRegistrationNumber: varchar("company_registration_number", {
    length: 80,
  }),
  vatRegistrationNumber: varchar("vat_registration_number", { length: 80 })
    .notNull()
    .default(""),
  invoiceEmail: varchar("invoice_email", { length: 254 })
    .notNull()
    .default(""),
  invoicePhone: varchar("invoice_phone", { length: 40 })
    .notNull()
    .default(""),
  addressLine1: varchar("address_line_1", { length: 240 })
    .notNull()
    .default(""),
  addressLine2: varchar("address_line_2", { length: 240 }),
  suburb: varchar("suburb", { length: 120 }),
  city: varchar("city", { length: 120 }).notNull().default(""),
  province: varchar("province", { length: 120 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 40 }).notNull().default(""),
  countryCode: varchar("country_code", { length: 2 })
    .notNull()
    .default("ZA"),
  collectionAddressSameAsRegistered: boolean(
    "collection_address_same_as_registered",
  )
    .notNull()
    .default(true),
  collectionContactName: varchar("collection_contact_name", { length: 160 })
    .notNull()
    .default(""),
  collectionContactPhone: varchar("collection_contact_phone", { length: 40 })
    .notNull()
    .default(""),
  collectionAddressLine1: varchar("collection_address_line_1", {
    length: 240,
  }),
  collectionAddressLine2: varchar("collection_address_line_2", {
    length: 240,
  }),
  collectionSuburb: varchar("collection_suburb", { length: 120 }),
  collectionCity: varchar("collection_city", { length: 120 }),
  collectionProvince: varchar("collection_province", { length: 120 }),
  collectionPostalCode: varchar("collection_postal_code", { length: 40 }),
  collectionCountryCode: varchar("collection_country_code", { length: 2 }),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const invoiceNumberSequences = pgTable("invoice_number_sequences", {
  key: varchar("key", { length: 40 }).primaryKey(),
  nextValue: bigint("next_value", { mode: "bigint" })
    .notNull()
    .default(BigInt(1)),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 96 }).notNull(),
    status: varchar("status", { length: 32 })
      .$type<"issued" | "partially_credited" | "credited">()
      .notNull()
      .default("issued"),
    renderStatus: varchar("render_status", { length: 32 })
      .$type<"pending" | "ready" | "failed">()
      .notNull()
      .default("pending"),
    issuedAt: timestamp("issued_at", { mode: "date" }).notNull(),
    supplyDate: timestamp("supply_date", { mode: "date" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
    issuerSnapshot: jsonb("issuer_snapshot")
      .$type<InvoiceIssuerSnapshot>()
      .notNull(),
    customerSnapshot: jsonb("customer_snapshot")
      .$type<InvoiceCustomerSnapshot>()
      .notNull(),
    subtotalExcludingTax: numeric("subtotal_excluding_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull(),
    totalIncludingTax: numeric("total_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull(),
    paymentReference: varchar("payment_reference", { length: 180 }),
    pdfRelativePath: text("pdf_relative_path"),
    pdfSha256: varchar("pdf_sha256", { length: 64 }),
    generationVersion: integer("generation_version").notNull().default(1),
    renderError: text("render_error"),
    renderedAt: timestamp("rendered_at", { mode: "date" }),
    emailSentAt: timestamp("email_sent_at", { mode: "date" }),
    whatsappSentAt: timestamp("whatsapp_sent_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (invoice) => ({
    invoiceNumberUnique: unique("invoices_invoice_number_unique").on(
      invoice.invoiceNumber,
    ),
    orderUnique: unique("invoices_order_id_unique").on(invoice.orderId),
    orderIdx: index("invoices_order_id_idx").on(invoice.orderId),
  }),
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull(),
    kind: varchar("kind", { length: 24 })
      .$type<"product" | "shipping" | "discount">()
      .notNull(),
    sku: varchar("sku", { length: 120 }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPriceIncludingTax: numeric("unit_price_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    lineTotalExcludingTax: numeric("line_total_excluding_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
    lineTotalIncludingTax: numeric("line_total_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (line) => ({
    invoicePositionUnique: unique("invoice_lines_invoice_position_unique").on(
      line.invoiceId,
      line.position,
    ),
    invoiceIdx: index("invoice_lines_invoice_id_idx").on(line.invoiceId),
  }),
);

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    creditNoteNumber: varchar("credit_note_number", { length: 96 }).notNull(),
    reason: text("reason").notNull(),
    issuedAt: timestamp("issued_at", { mode: "date" }).notNull(),
    subtotalExcludingTax: numeric("subtotal_excluding_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull(),
    totalIncludingTax: numeric("total_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    renderStatus: varchar("render_status", { length: 32 })
      .$type<"pending" | "ready" | "failed">()
      .notNull()
      .default("pending"),
    pdfRelativePath: text("pdf_relative_path"),
    pdfSha256: varchar("pdf_sha256", { length: 64 }),
    generationVersion: integer("generation_version").notNull().default(1),
    renderError: text("render_error"),
    renderedAt: timestamp("rendered_at", { mode: "date" }),
    emailDeliveryStatus: varchar("email_delivery_status", { length: 32 })
      .$type<
        "pending" | "verification_required" | "sent" | "skipped" | "failed"
      >()
      .notNull()
      .default("pending"),
    emailDeliveryError: text("email_delivery_error"),
    emailSentAt: timestamp("email_sent_at", { mode: "date" }),
    whatsappDeliveryStatus: varchar("whatsapp_delivery_status", { length: 32 })
      .$type<
        "pending" | "verification_required" | "sent" | "skipped" | "failed"
      >()
      .notNull()
      .default("pending"),
    whatsappDeliveryError: text("whatsapp_delivery_error"),
    whatsappSentAt: timestamp("whatsapp_sent_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (creditNote) => ({
    numberUnique: unique("credit_notes_number_unique").on(
      creditNote.creditNoteNumber,
    ),
    invoiceIdx: index("credit_notes_invoice_id_idx").on(creditNote.invoiceId),
  }),
);

export const creditNoteLines = pgTable(
  "credit_note_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "restrict" }),
    invoiceLineId: uuid("invoice_line_id")
      .notNull()
      .references(() => invoiceLines.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    kind: varchar("kind", { length: 24 })
      .$type<"product" | "shipping" | "discount">()
      .notNull(),
    sku: varchar("sku", { length: 120 }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPriceIncludingTax: numeric("unit_price_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    lineTotalExcludingTax: numeric("line_total_excluding_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
    lineTotalIncludingTax: numeric("line_total_including_tax", {
      precision: 14,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (line) => ({
    creditNotePositionUnique: unique(
      "credit_note_lines_credit_note_position_unique",
    ).on(line.creditNoteId, line.position),
    creditNoteIdx: index("credit_note_lines_credit_note_id_idx").on(
      line.creditNoteId,
    ),
    invoiceLineIdx: index("credit_note_lines_invoice_line_id_idx").on(
      line.invoiceLineId,
    ),
  }),
);

export const creditNoteAccessTokens = pgTable(
  "credit_note_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (token) => ({
    tokenHashUnique: unique("credit_note_access_tokens_hash_unique").on(
      token.tokenHash,
    ),
    creditNoteIdx: index("credit_note_access_tokens_credit_note_id_idx").on(
      token.creditNoteId,
    ),
  }),
);

export const creditNoteDeliveryAttempts = pgTable(
  "credit_note_delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 24 })
      .$type<CreditNoteDeliveryChannel>()
      .notNull(),
    status: varchar("status", { length: 32 })
      .$type<CreditNoteDeliveryAttemptStatus>()
      .notNull()
      .default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    claimToken: uuid("claim_token"),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lastAttemptStartedAt: timestamp("last_attempt_started_at", { mode: "date" }),
    lastAttemptCompletedAt: timestamp("last_attempt_completed_at", {
      mode: "date",
    }),
    providerStatus: integer("provider_status"),
    providerMessageId: varchar("provider_message_id", { length: 240 }),
    outcomeUnknown: boolean("outcome_unknown").notNull().default(false),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { mode: "date" }),
    skippedAt: timestamp("skipped_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    verificationRequiredAt: timestamp("verification_required_at", {
      mode: "date",
    }),
    manualResetAt: timestamp("manual_reset_at", { mode: "date" }),
    manualResetByUserId: uuid("manual_reset_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (attempt) => ({
    creditNoteChannelUnique: unique(
      "credit_note_delivery_attempts_credit_note_channel_unique",
    ).on(attempt.creditNoteId, attempt.channel),
    idempotencyUnique: unique(
      "credit_note_delivery_attempts_idempotency_key_unique",
    ).on(attempt.idempotencyKey),
    statusAvailableIdx: index(
      "credit_note_delivery_attempts_status_available_idx",
    ).on(attempt.status, attempt.availableAt),
  }),
);

export const creditNoteJobs = pgTable(
  "credit_note_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    jobType: varchar("job_type", { length: 40 })
      .$type<"render_and_deliver" | "deliver">()
      .notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    status: varchar("status", { length: 32 })
      .$type<"pending" | "processing" | "completed" | "failed">()
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
    idempotencyUnique: unique("credit_note_jobs_idempotency_unique").on(
      job.idempotencyKey,
    ),
    statusAvailableIdx: index("credit_note_jobs_status_available_idx").on(
      job.status,
      job.availableAt,
    ),
  }),
);

export const invoiceAccessTokens = pgTable(
  "invoice_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (token) => ({
    tokenHashUnique: unique("invoice_access_tokens_hash_unique").on(
      token.tokenHash,
    ),
    invoiceIdx: index("invoice_access_tokens_invoice_id_idx").on(
      token.invoiceId,
    ),
  }),
);

export const invoiceJobs = pgTable(
  "invoice_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    jobType: varchar("job_type", { length: 40 })
      .$type<"render_and_deliver" | "deliver">()
      .notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    status: varchar("status", { length: 32 })
      .$type<"pending" | "processing" | "completed" | "failed">()
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
    idempotencyUnique: unique("invoice_jobs_idempotency_unique").on(
      job.idempotencyKey,
    ),
    statusAvailableIdx: index("invoice_jobs_status_available_idx").on(
      job.status,
      job.availableAt,
    ),
  }),
);
