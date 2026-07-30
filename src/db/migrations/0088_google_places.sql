ALTER TABLE "marketplace_settings"
  ADD COLUMN "google_places_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN "google_places_api_key_encrypted" text;
