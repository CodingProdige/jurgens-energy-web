ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "booking_quote_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'shipments_booking_quote_id_shipping_rate_quotes_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_booking_quote_id_shipping_rate_quotes_id_fk"
      FOREIGN KEY ("booking_quote_id")
      REFERENCES "public"."shipping_rate_quotes"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_booking_quote_id_unique"
  ON "shipments" USING btree ("booking_quote_id")
  WHERE "booking_quote_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "courier_guy_max_booking_cost_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "courier_guy_max_absorbed_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_cg_max_booking_cost_nonnegative",
  ADD CONSTRAINT "marketplace_settings_cg_max_booking_cost_nonnegative"
    CHECK (
      "courier_guy_max_booking_cost_amount" IS NULL
      OR "courier_guy_max_booking_cost_amount" >= 0
    ),
  DROP CONSTRAINT IF EXISTS "marketplace_settings_cg_max_absorbed_nonnegative",
  ADD CONSTRAINT "marketplace_settings_cg_max_absorbed_nonnegative"
    CHECK (
      "courier_guy_max_absorbed_amount" IS NULL
      OR "courier_guy_max_absorbed_amount" >= 0
    );
