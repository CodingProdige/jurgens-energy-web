ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_merchant_minimum_product_price" numeric(12, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_google_merchant_minimum_product_price_nonnegative",
  ADD CONSTRAINT "marketplace_settings_google_merchant_minimum_product_price_nonnegative"
    CHECK ("google_merchant_minimum_product_price" >= 0);
