ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_ordering_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_provider" varchar(32) DEFAULT '360dialog' NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_business_phone_number" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_message_url" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_api_key_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_webhook_verify_token_encrypted" text;
