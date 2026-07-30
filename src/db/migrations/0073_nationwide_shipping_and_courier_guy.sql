ALTER TYPE "shipping_provider" ADD VALUE IF NOT EXISTS 'courier_guy' BEFORE 'jurgens_local';
--> statement-breakpoint
ALTER TYPE "shipment_status" ADD VALUE IF NOT EXISTS 'booking' AFTER 'pending_booking';
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "shipping_flat_rate" numeric(12, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "shipping_free_over_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "courier_guy_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "courier_guy_mode" varchar(16) DEFAULT 'sandbox' NOT NULL,
  ADD COLUMN IF NOT EXISTS "courier_guy_live_api_key_encrypted" text,
  ADD COLUMN IF NOT EXISTS "courier_guy_sandbox_api_key_encrypted" text,
  ADD COLUMN IF NOT EXISTS "courier_guy_webhook_token_encrypted" text,
  ADD COLUMN IF NOT EXISTS "courier_guy_default_service_code" varchar(64),
  ADD COLUMN IF NOT EXISTS "courier_guy_dropoff_type" varchar(32) DEFAULT 'generic_kiosk' NOT NULL,
  ADD COLUMN IF NOT EXISTS "courier_guy_dropoff_pickup_point_id" varchar(120),
  ADD COLUMN IF NOT EXISTS "courier_guy_dropoff_provider" varchar(80) DEFAULT 'tcg-locker' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_shipping_flat_rate_nonnegative",
  ADD CONSTRAINT "marketplace_settings_shipping_flat_rate_nonnegative"
    CHECK ("shipping_flat_rate" >= 0),
  DROP CONSTRAINT IF EXISTS "marketplace_settings_shipping_free_over_nonnegative",
  ADD CONSTRAINT "marketplace_settings_shipping_free_over_nonnegative"
    CHECK ("shipping_free_over_amount" IS NULL OR "shipping_free_over_amount" > 0);
--> statement-breakpoint
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "provider_cost_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "provider_cost_currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "service_code" varchar(120),
  ADD COLUMN IF NOT EXISTS "service_name" varchar(160);
--> statement-breakpoint
ALTER TABLE "shipments"
  DROP CONSTRAINT IF EXISTS "shipments_provider_cost_nonnegative",
  ADD CONSTRAINT "shipments_provider_cost_nonnegative"
    CHECK ("provider_cost_amount" IS NULL OR "provider_cost_amount" >= 0),
  DROP CONSTRAINT IF EXISTS "shipments_provider_cost_currency_present",
  ADD CONSTRAINT "shipments_provider_cost_currency_present"
    CHECK (
      "provider_cost_amount" IS NULL
      OR (
        "provider_cost_currency" IS NOT NULL
        AND char_length("provider_cost_currency") = 3
      )
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courier_guy_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" varchar(160) NOT NULL,
  "provider_environment" varchar(16) NOT NULL,
  "provider_event_id" text NOT NULL,
  "provider_shipment_id" text,
  "tracking_reference" text,
  "status" varchar(32) DEFAULT 'received' NOT NULL,
  "payload" jsonb NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  CONSTRAINT "courier_guy_webhook_events_provider_event_unique"
    UNIQUE ("provider_environment", "provider_event_id"),
  CONSTRAINT "courier_guy_webhook_events_environment_valid"
    CHECK ("provider_environment" IN ('live', 'sandbox'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_webhook_events_provider_shipment_id_idx"
  ON "courier_guy_webhook_events" USING btree (
    "provider_environment",
    "provider_shipment_id"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_webhook_events_tracking_reference_idx"
  ON "courier_guy_webhook_events" USING btree (
    "provider_environment",
    "tracking_reference"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_webhook_events_topic_idx"
  ON "courier_guy_webhook_events" USING btree ("topic");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "shipments"
    WHERE
      "provider" = 'bobgo'
      AND "status" NOT IN ('delivered', 'returned', 'cancelled')
  ) THEN
    RAISE EXCEPTION
      'Courier Guy cutover blocked: reconcile all nonterminal BobGo shipments before applying migration 0073.';
  END IF;
END
$$;
--> statement-breakpoint
UPDATE "marketplace_settings"
SET
  "bobgo_enabled" = false,
  "bobgo_booking_mode" = 'disabled',
  "shipping_enabled" = false,
  "updated_at" = now()
WHERE "id" = 1;
