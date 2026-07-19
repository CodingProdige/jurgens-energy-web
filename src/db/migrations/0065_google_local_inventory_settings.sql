ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_local_inventory_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_local_inventory_store_code" text;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_local_inventory_customer_accessible" boolean DEFAULT false NOT NULL;
