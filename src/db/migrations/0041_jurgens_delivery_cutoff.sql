ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "jurgens_delivery_cutoff_time" varchar(5) DEFAULT '14:00' NOT NULL;
