ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "courier_guy_dropoff_pickup_point_label" varchar(500);
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_dropoff_pickup_point_label_valid",
  ADD CONSTRAINT "marketplace_settings_courier_guy_dropoff_pickup_point_label_valid"
    CHECK (
      "courier_guy_dropoff_pickup_point_label" IS NULL
      OR btrim("courier_guy_dropoff_pickup_point_label") <> ''
    );
