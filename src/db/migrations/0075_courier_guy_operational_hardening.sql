ALTER TYPE "shipment_status" ADD VALUE IF NOT EXISTS 'cancelling' AFTER 'ready_for_collection';
--> statement-breakpoint
ALTER TYPE "shipment_status" ADD VALUE IF NOT EXISTS 'undeliverable' AFTER 'returned';
--> statement-breakpoint
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "provider_environment" varchar(16),
  ADD COLUMN IF NOT EXISTS "provider_account_id" integer;
--> statement-breakpoint
UPDATE "shipments" AS "shipment"
SET
  "provider_environment" = COALESCE(
    "shipment"."provider_environment",
    "settings"."courier_guy_mode"
  ),
  "provider_account_id" = COALESCE(
    "shipment"."provider_account_id",
    CASE
      WHEN "settings"."courier_guy_mode" = 'live'
        THEN "settings"."courier_guy_live_account_id"
      ELSE "settings"."courier_guy_sandbox_account_id"
    END
  )
FROM "marketplace_settings" AS "settings"
WHERE
  "settings"."id" = 1
  AND "shipment"."provider" = 'courier_guy'
  AND (
    "shipment"."provider_shipment_id" IS NOT NULL
    OR "shipment"."tracking_number" IS NOT NULL
  );
--> statement-breakpoint
ALTER TABLE "shipments"
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_environment_valid",
  ADD CONSTRAINT "shipments_courier_guy_environment_valid"
    CHECK (
      "provider_environment" IS NULL
      OR "provider_environment" IN ('live', 'sandbox')
    ),
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_account_positive",
  ADD CONSTRAINT "shipments_courier_guy_account_positive"
    CHECK (
      "provider_account_id" IS NULL
      OR "provider_account_id" > 0
    ),
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_identity_scoped",
  ADD CONSTRAINT "shipments_courier_guy_identity_scoped"
    CHECK (
      "provider" <> 'courier_guy'
      OR (
        (
          "provider_shipment_id" IS NULL
          AND "tracking_number" IS NULL
        )
        OR (
          "provider_environment" IS NOT NULL
          AND "provider_account_id" IS NOT NULL
        )
      )
    );
--> statement-breakpoint
ALTER TABLE "courier_guy_webhook_events"
  ADD COLUMN IF NOT EXISTS "provider_environment" varchar(16),
  ADD COLUMN IF NOT EXISTS "tracking_reference" text;
--> statement-breakpoint
UPDATE "courier_guy_webhook_events"
SET
  "provider_environment" = COALESCE(
    "provider_environment",
    (
      SELECT "courier_guy_mode"
      FROM "marketplace_settings"
      WHERE "id" = 1
    ),
    'sandbox'
  ),
  "tracking_reference" = COALESCE(
    "tracking_reference",
    "payload" ->> 'short_tracking_reference',
    "payload" ->> 'tracking_reference',
    "payload" ->> 'trackingReference',
    "payload" -> 'shipment' ->> 'short_tracking_reference',
    "payload" -> 'shipment' ->> 'tracking_reference',
    "payload" -> 'data' ->> 'short_tracking_reference',
    "payload" -> 'data' ->> 'tracking_reference',
    "payload" -> 'data' -> 'shipment' ->> 'short_tracking_reference'
  )
WHERE
  "provider_environment" IS NULL
  OR "tracking_reference" IS NULL;
--> statement-breakpoint
ALTER TABLE "courier_guy_webhook_events"
  ALTER COLUMN "provider_environment" SET NOT NULL,
  DROP CONSTRAINT IF EXISTS "courier_guy_webhook_events_provider_event_unique",
  ADD CONSTRAINT "courier_guy_webhook_events_provider_event_unique"
    UNIQUE ("provider_environment", "provider_event_id"),
  DROP CONSTRAINT IF EXISTS "courier_guy_webhook_events_environment_valid",
  ADD CONSTRAINT "courier_guy_webhook_events_environment_valid"
    CHECK ("provider_environment" IN ('live', 'sandbox'));
--> statement-breakpoint
DROP INDEX IF EXISTS "courier_guy_webhook_events_provider_shipment_id_idx";
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
DROP INDEX IF EXISTS "shipment_events_courier_guy_provider_event_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_events_courier_guy_provider_event_unique"
  ON "shipment_events" USING btree (
    "shipment_id",
    "provider",
    "provider_event_id"
  )
  WHERE "provider" = 'courier_guy' AND "provider_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_courier_guy_provider_shipment_unique"
  ON "shipments" USING btree (
    "provider",
    "provider_environment",
    "provider_shipment_id"
  )
  WHERE "provider" = 'courier_guy' AND "provider_shipment_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_courier_guy_tracking_unique"
  ON "shipments" USING btree (
    "provider",
    "provider_environment",
    "tracking_number"
  )
  WHERE "provider" = 'courier_guy' AND "tracking_number" IS NOT NULL;
