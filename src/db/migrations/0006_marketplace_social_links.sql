ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "facebook_url" text,
  ADD COLUMN IF NOT EXISTS "instagram_url" text,
  ADD COLUMN IF NOT EXISTS "twitter_url" text;
