ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_mode" varchar(16) NOT NULL DEFAULT 'sandbox';

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_onsite_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_tokenization_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_live_merchant_id" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_live_merchant_key_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_live_passphrase_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_sandbox_merchant_id" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_sandbox_merchant_key_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "payfast_sandbox_passphrase_encrypted" text;
