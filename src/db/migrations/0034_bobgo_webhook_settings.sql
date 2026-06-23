ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_booking_mode" varchar(32) DEFAULT 'disabled' NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_tracking_updated" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_fulfillment_created" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_shipment_submission_status_updated" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_shipment_charged_amount_changed" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_shipment_charged_weight_changed" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_webhook_shipment_health_status_updated" boolean DEFAULT true NOT NULL;

UPDATE "marketplace_settings"
SET
  "bobgo_api_key_encrypted" = COALESCE(
    "bobgo_api_key_encrypted",
    "bobgo_sandbox_api_key_encrypted"
  ),
  "bobgo_webhook_secret_encrypted" = COALESCE(
    "bobgo_webhook_secret_encrypted",
    "bobgo_sandbox_webhook_secret_encrypted"
  )
WHERE "id" = 1;

CREATE TABLE IF NOT EXISTS "bobgo_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" varchar(160) NOT NULL,
  "provider_event_id" text NOT NULL,
  "provider_shipment_id" text,
  "status" varchar(32) DEFAULT 'received' NOT NULL,
  "payload" jsonb NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  CONSTRAINT "bobgo_webhook_events_provider_event_unique" UNIQUE("provider_event_id")
);

CREATE INDEX IF NOT EXISTS "bobgo_webhook_events_provider_shipment_id_idx"
  ON "bobgo_webhook_events" ("provider_shipment_id");

CREATE INDEX IF NOT EXISTS "bobgo_webhook_events_topic_idx"
  ON "bobgo_webhook_events" ("topic");
