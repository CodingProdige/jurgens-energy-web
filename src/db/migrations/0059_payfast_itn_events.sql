DO $$
BEGIN
  CREATE TYPE "payfast_itn_event_status" AS ENUM ('received', 'processed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payfast_itn_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_reference" varchar(160),
  "provider_payment_id" varchar(160),
  "provider_status" varchar(80),
  "source_ip" varchar(64),
  "cf_connecting_ip" varchar(64),
  "x_forwarded_for" varchar(1024),
  "status" "payfast_itn_event_status" DEFAULT 'received' NOT NULL,
  "validation_stage" varchar(80),
  "error_code" varchar(120),
  "error_message" text,
  "payload" jsonb NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payfast_itn_events_payment_reference_idx"
  ON "payfast_itn_events" ("payment_reference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payfast_itn_events_received_at_idx"
  ON "payfast_itn_events" ("received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payfast_itn_events_status_received_at_idx"
  ON "payfast_itn_events" ("status", "received_at");
--> statement-breakpoint
UPDATE "payments"
SET "raw_payload" = jsonb_strip_nulls(jsonb_build_object(
  'm_payment_id', "raw_payload" -> 'm_payment_id',
  'pf_payment_id', "raw_payload" -> 'pf_payment_id',
  'payment_status', "raw_payload" -> 'payment_status',
  'item_name', "raw_payload" -> 'item_name',
  'item_description', "raw_payload" -> 'item_description',
  'amount_gross', "raw_payload" -> 'amount_gross',
  'amount_fee', "raw_payload" -> 'amount_fee',
  'amount_net', "raw_payload" -> 'amount_net',
  'custom_str1', "raw_payload" -> 'custom_str1',
  'merchant_id', "raw_payload" -> 'merchant_id'
))
WHERE "provider" = 'payfast'
  AND "raw_payload" IS NOT NULL;
