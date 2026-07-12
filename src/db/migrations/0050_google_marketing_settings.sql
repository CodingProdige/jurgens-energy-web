ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_tag_manager_id" text,
  ADD COLUMN IF NOT EXISTS "google_analytics_measurement_id" text,
  ADD COLUMN IF NOT EXISTS "google_ads_conversion_id" text,
  ADD COLUMN IF NOT EXISTS "google_ads_conversion_label" text,
  ADD COLUMN IF NOT EXISTS "google_merchant_center_id" text,
  ADD COLUMN IF NOT EXISTS "google_site_verification_token" text;
