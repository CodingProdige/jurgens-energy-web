ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "footer_tagline" text,
  ADD COLUMN IF NOT EXISTS "contact_phone_primary" text,
  ADD COLUMN IF NOT EXISTS "contact_phone_secondary" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text,
  ADD COLUMN IF NOT EXISTS "contact_address" text,
  ADD COLUMN IF NOT EXISTS "payment_method_badges" text;
