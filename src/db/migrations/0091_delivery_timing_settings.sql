ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "shipping_handling_min_business_days" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "shipping_handling_max_business_days" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "shipping_transit_min_business_days" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "shipping_transit_max_business_days" integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_shipping_handling_days_valid",
  ADD CONSTRAINT "marketplace_settings_shipping_handling_days_valid"
    CHECK (
      "shipping_handling_min_business_days" >= 0
      AND "shipping_handling_max_business_days" <= 30
      AND "shipping_handling_min_business_days" <= "shipping_handling_max_business_days"
    ),
  DROP CONSTRAINT IF EXISTS "marketplace_settings_shipping_transit_days_valid",
  ADD CONSTRAINT "marketplace_settings_shipping_transit_days_valid"
    CHECK (
      "shipping_transit_min_business_days" >= 0
      AND "shipping_transit_max_business_days" <= 60
      AND "shipping_transit_min_business_days" <= "shipping_transit_max_business_days"
    );
