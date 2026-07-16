CREATE TABLE IF NOT EXISTS "business_information" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "legal_name" varchar(200) DEFAULT '' NOT NULL,
  "trading_name" varchar(200) DEFAULT 'Jurgens Energy' NOT NULL,
  "company_registration_number" varchar(80),
  "vat_registration_number" varchar(80) DEFAULT '' NOT NULL,
  "invoice_email" varchar(254) DEFAULT '' NOT NULL,
  "invoice_phone" varchar(40) DEFAULT '' NOT NULL,
  "address_line_1" varchar(240) DEFAULT '' NOT NULL,
  "address_line_2" varchar(240),
  "suburb" varchar(120),
  "city" varchar(120) DEFAULT '' NOT NULL,
  "province" varchar(120) DEFAULT '' NOT NULL,
  "postal_code" varchar(40) DEFAULT '' NOT NULL,
  "country_code" varchar(2) DEFAULT 'ZA' NOT NULL,
  "collection_address_same_as_registered" boolean DEFAULT true NOT NULL,
  "collection_contact_name" varchar(160) DEFAULT '' NOT NULL,
  "collection_contact_phone" varchar(40) DEFAULT '' NOT NULL,
  "collection_address_line_1" varchar(240),
  "collection_address_line_2" varchar(240),
  "collection_suburb" varchar(120),
  "collection_city" varchar(120),
  "collection_province" varchar(120),
  "collection_postal_code" varchar(40),
  "collection_country_code" varchar(2),
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "business_information_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
INSERT INTO "business_information" ("id", "trading_name")
VALUES (1, 'Jurgens Energy')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
WITH legacy_collection AS (
  SELECT
    profile."address_line_1",
    profile."address_line_2",
    profile."city",
    profile."contact_email",
    profile."contact_name",
    profile."contact_phone",
    profile."country_code",
    profile."postal_code",
    profile."province",
    profile."suburb"
  FROM "seller_fulfillment_profiles" AS profile
  INNER JOIN "sellers" AS seller ON seller."id" = profile."seller_id"
  ORDER BY
    CASE WHEN lower(seller."display_name") = 'jurgens energy' THEN 0 ELSE 1 END,
    profile."updated_at" DESC
  LIMIT 1
)
UPDATE "business_information" AS business
SET
  "address_line_1" = legacy."address_line_1",
  "address_line_2" = legacy."address_line_2",
  "suburb" = NULLIF(legacy."suburb", ''),
  "city" = legacy."city",
  "province" = legacy."province",
  "postal_code" = legacy."postal_code",
  "country_code" = legacy."country_code",
  "invoice_email" = legacy."contact_email",
  "invoice_phone" = legacy."contact_phone",
  "collection_contact_name" = legacy."contact_name",
  "collection_contact_phone" = legacy."contact_phone",
  "collection_address_same_as_registered" = true,
  "updated_at" = now()
FROM legacy_collection AS legacy
WHERE business."id" = 1
  AND business."address_line_1" = '';
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "tax_rate_bps" integer DEFAULT 1500 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "billing_details_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "sku_snapshot" varchar(120),
  ADD COLUMN IF NOT EXISTS "tax_rate_bps" integer DEFAULT 1500 NOT NULL;
--> statement-breakpoint
UPDATE "order_items" AS oi
SET "sku_snapshot" = pv."sku"
FROM "product_variants" AS pv
WHERE oi."variant_id" = pv."id"
  AND oi."sku_snapshot" IS NULL;
--> statement-breakpoint
ALTER TABLE "customer_addresses"
  ALTER COLUMN "suburb" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_number_sequences" (
  "key" varchar(40) PRIMARY KEY NOT NULL,
  "next_value" bigint DEFAULT 1 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "invoice_number_sequences" ("key", "next_value")
VALUES ('invoice', 1), ('credit_note', 1)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE restrict,
  "invoice_number" varchar(96) NOT NULL,
  "status" varchar(32) DEFAULT 'issued' NOT NULL,
  "render_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "issued_at" timestamp NOT NULL,
  "supply_date" timestamp NOT NULL,
  "currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
  "issuer_snapshot" jsonb NOT NULL,
  "customer_snapshot" jsonb NOT NULL,
  "subtotal_excluding_tax" numeric(14,2) NOT NULL,
  "tax_total" numeric(14,2) NOT NULL,
  "total_including_tax" numeric(14,2) NOT NULL,
  "amount_paid" numeric(14,2) NOT NULL,
  "payment_reference" varchar(180),
  "pdf_relative_path" text,
  "pdf_sha256" varchar(64),
  "generation_version" integer DEFAULT 1 NOT NULL,
  "render_error" text,
  "rendered_at" timestamp,
  "email_sent_at" timestamp,
  "whatsapp_sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
  CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id"),
  CONSTRAINT "invoices_status_check" CHECK ("status" IN ('issued', 'partially_credited', 'credited')),
  CONSTRAINT "invoices_render_status_check" CHECK ("render_status" IN ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_order_id_idx" ON "invoices" ("order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE restrict,
  "order_item_id" uuid REFERENCES "order_items"("id") ON DELETE set null,
  "position" integer NOT NULL,
  "kind" varchar(24) NOT NULL,
  "sku" varchar(120),
  "description" text NOT NULL,
  "quantity" numeric(14,3) NOT NULL,
  "unit_price_including_tax" numeric(14,2) NOT NULL,
  "tax_rate_bps" integer NOT NULL,
  "line_total_excluding_tax" numeric(14,2) NOT NULL,
  "tax_amount" numeric(14,2) NOT NULL,
  "line_total_including_tax" numeric(14,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_lines_invoice_position_unique" UNIQUE("invoice_id", "position"),
  CONSTRAINT "invoice_lines_kind_check" CHECK ("kind" IN ('product', 'shipping', 'discount'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_lines_invoice_id_idx" ON "invoice_lines" ("invoice_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE restrict,
  "credit_note_number" varchar(96) NOT NULL,
  "reason" text NOT NULL,
  "issued_at" timestamp NOT NULL,
  "subtotal_excluding_tax" numeric(14,2) NOT NULL,
  "tax_total" numeric(14,2) NOT NULL,
  "total_including_tax" numeric(14,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "credit_notes_number_unique" UNIQUE("credit_note_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_notes_invoice_id_idx" ON "credit_notes" ("invoice_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_access_tokens_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_access_tokens_invoice_id_idx"
  ON "invoice_access_tokens" ("invoice_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "job_type" varchar(40) NOT NULL,
  "idempotency_key" varchar(180) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "last_error" text,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_jobs_idempotency_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "invoice_jobs_type_check" CHECK ("job_type" IN ('render_and_deliver', 'deliver')),
  CONSTRAINT "invoice_jobs_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_jobs_status_available_idx"
  ON "invoice_jobs" ("status", "available_at");
--> statement-breakpoint
INSERT INTO "notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "status",
  "subject",
  "preview_text",
  "html_body",
  "text_body",
  "required_variables"
)
VALUES (
  'customer_invoice_issued',
  'Customer tax invoice',
  'orders',
  'Sent after a successful payment when the customer tax invoice is ready.',
  'active',
  'Your Jurgens Energy tax invoice {{invoice_number}}',
  'Thank you for your order. Your paid tax invoice is ready.',
  '<h1>Thank you for your order</h1><p>Hi {{customer_name}},</p><p>Payment for order <strong>{{order_number}}</strong> has been confirmed.</p><p>Your tax invoice <strong>{{invoice_number}}</strong> for <strong>{{invoice_total}}</strong> is attached and can also be downloaded securely below.</p><p><a href="{{invoice_download_url}}">Download tax invoice</a></p>',
  'Hi {{customer_name}},\n\nThank you for your order. Payment for order {{order_number}} has been confirmed.\n\nYour tax invoice {{invoice_number}} for {{invoice_total}} is attached. You can also download it securely here: {{invoice_download_url}}',
  '["customer_name","order_number","invoice_number","invoice_total","invoice_download_url"]'
)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_delivery_policies" (
  "event_key",
  "in_app_enabled",
  "email_enabled",
  "push_enabled",
  "priority",
  "quiet_hours_enabled",
  "digest_eligible"
)
VALUES (
  'customer_invoice_issued',
  false,
  true,
  false,
  'high',
  false,
  false
)
ON CONFLICT ("event_key") DO NOTHING;
