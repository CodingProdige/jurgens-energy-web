ALTER TABLE "credit_notes"
  ADD COLUMN IF NOT EXISTS "render_status" varchar(32) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "pdf_relative_path" text,
  ADD COLUMN IF NOT EXISTS "pdf_sha256" varchar(64),
  ADD COLUMN IF NOT EXISTS "generation_version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "render_error" text,
  ADD COLUMN IF NOT EXISTS "rendered_at" timestamp,
  ADD COLUMN IF NOT EXISTS "email_delivery_status" varchar(32) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "email_delivery_error" text,
  ADD COLUMN IF NOT EXISTS "email_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "whatsapp_delivery_status" varchar(32) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "whatsapp_delivery_error" text,
  ADD COLUMN IF NOT EXISTS "whatsapp_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_render_status_check'
  ) THEN
    ALTER TABLE "credit_notes"
      ADD CONSTRAINT "credit_notes_render_status_check"
      CHECK ("render_status" IN ('pending', 'ready', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_email_delivery_status_check'
  ) THEN
    ALTER TABLE "credit_notes"
      ADD CONSTRAINT "credit_notes_email_delivery_status_check"
      CHECK ("email_delivery_status" IN ('pending', 'sent', 'skipped', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_whatsapp_delivery_status_check'
  ) THEN
    ALTER TABLE "credit_notes"
      ADD CONSTRAINT "credit_notes_whatsapp_delivery_status_check"
      CHECK ("whatsapp_delivery_status" IN ('pending', 'sent', 'skipped', 'failed'));
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_note_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE restrict,
  "invoice_line_id" uuid NOT NULL REFERENCES "invoice_lines"("id") ON DELETE restrict,
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
  CONSTRAINT "credit_note_lines_credit_note_position_unique" UNIQUE("credit_note_id", "position"),
  CONSTRAINT "credit_note_lines_kind_check" CHECK ("kind" IN ('product', 'shipping', 'discount')),
  CONSTRAINT "credit_note_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "credit_note_lines_gross_check" CHECK ("line_total_including_tax" > 0),
  CONSTRAINT "credit_note_lines_totals_check" CHECK ("line_total_excluding_tax" + "tax_amount" = "line_total_including_tax")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_note_lines_credit_note_id_idx"
  ON "credit_note_lines" ("credit_note_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_note_lines_invoice_line_id_idx"
  ON "credit_note_lines" ("invoice_line_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_note_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "credit_note_access_tokens_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_note_access_tokens_credit_note_id_idx"
  ON "credit_note_access_tokens" ("credit_note_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_note_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE cascade,
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
  CONSTRAINT "credit_note_jobs_idempotency_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "credit_note_jobs_type_check" CHECK ("job_type" IN ('render_and_deliver', 'deliver')),
  CONSTRAINT "credit_note_jobs_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_note_jobs_status_available_idx"
  ON "credit_note_jobs" ("status", "available_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE restrict,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE restrict,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE restrict,
  "credit_note_id" uuid REFERENCES "credit_notes"("id") ON DELETE restrict,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "idempotency_key" varchar(180) NOT NULL,
  "request_fingerprint" varchar(64) NOT NULL,
  "provider" varchar(40) DEFAULT 'payfast' NOT NULL,
  "provider_payment_id" varchar(160) NOT NULL,
  "refund_kind" varchar(16) NOT NULL,
  "refund_method" varchar(32) DEFAULT 'unknown' NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "reason" text NOT NULL,
  "notify_buyer" boolean DEFAULT true NOT NULL,
  "notify_merchant" boolean DEFAULT false NOT NULL,
  "requested_allocations" jsonb NOT NULL,
  "provider_available_before_cents" integer,
  "provider_available_after_cents" integer,
  "provider_status" varchar(120),
  "provider_query_response" jsonb,
  "provider_create_response" jsonb,
  "provider_retrieve_response" jsonb,
  "provider_http_status" integer,
  "provider_request_started_at" timestamp,
  "manual_action_reason" text,
  "error_code" varchar(80),
  "error_message" text,
  "submitted_at" timestamp,
  "completed_at" timestamp,
  "failed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payment_refunds_credit_note_id_unique" UNIQUE("credit_note_id"),
  CONSTRAINT "payment_refunds_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "payment_refunds_kind_check" CHECK ("refund_kind" IN ('full', 'partial')),
  CONSTRAINT "payment_refunds_method_check" CHECK ("refund_method" IN ('payment_source', 'bank_payout', 'not_available', 'unknown')),
  CONSTRAINT "payment_refunds_status_check" CHECK ("status" IN ('pending', 'manual_required', 'submitted', 'verification_required', 'completed', 'failed')),
  CONSTRAINT "payment_refunds_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refunds_order_id_idx"
  ON "payment_refunds" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refunds_payment_status_idx"
  ON "payment_refunds" ("payment_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_refund_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "refund_id" uuid NOT NULL REFERENCES "payment_refunds"("id") ON DELETE cascade,
  "invoice_line_id" uuid NOT NULL REFERENCES "invoice_lines"("id") ON DELETE restrict,
  "position" integer NOT NULL,
  "quantity" numeric(14,3) NOT NULL,
  "net_amount" numeric(14,2) NOT NULL,
  "tax_amount" numeric(14,2) NOT NULL,
  "gross_amount" numeric(14,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payment_refund_allocations_refund_invoice_line_unique" UNIQUE("refund_id", "invoice_line_id"),
  CONSTRAINT "payment_refund_allocations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "payment_refund_allocations_gross_check" CHECK ("gross_amount" > 0),
  CONSTRAINT "payment_refund_allocations_totals_check" CHECK ("net_amount" + "tax_amount" = "gross_amount")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refund_allocations_refund_id_idx"
  ON "payment_refund_allocations" ("refund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refund_allocations_invoice_line_id_idx"
  ON "payment_refund_allocations" ("invoice_line_id");
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
  'customer_credit_note_issued',
  'Customer tax credit note',
  'orders',
  'Sent after a completed refund when the customer tax credit note is ready.',
  'active',
  'Your Jurgens Energy credit note {{credit_note_number}}',
  'A credit note for order {{order_number}} is ready.',
  '<h1>Your credit note is ready</h1><p>Hi {{customer_name}},</p><p>We have issued credit note <strong>{{credit_note_number}}</strong> against tax invoice <strong>{{invoice_number}}</strong> for order <strong>{{order_number}}</strong>.</p><p>Credited total: <strong>{{credit_note_total}}</strong></p><p>Reason: {{credit_note_reason}}</p><p><a href="{{credit_note_download_url}}">Download credit note</a></p>',
  'Hi {{customer_name}},\n\nWe have issued credit note {{credit_note_number}} against tax invoice {{invoice_number}} for order {{order_number}}.\n\nCredited total: {{credit_note_total}}\nReason: {{credit_note_reason}}\n\nDownload it securely here: {{credit_note_download_url}}',
  '["customer_name","order_number","invoice_number","credit_note_number","credit_note_total","credit_note_reason","credit_note_download_url"]'
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
  'customer_credit_note_issued',
  false,
  true,
  false,
  'high',
  false,
  false
)
ON CONFLICT ("event_key") DO NOTHING;
