ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "sendgrid_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "sendgrid_api_key_encrypted" text,
  ADD COLUMN IF NOT EXISTS "sendgrid_from_email" text,
  ADD COLUMN IF NOT EXISTS "sendgrid_from_name" text DEFAULT 'Jurgens Energy' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sendgrid_webhook_public_key_encrypted" text;
