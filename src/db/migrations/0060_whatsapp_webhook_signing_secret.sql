ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_webhook_signing_secret_encrypted" text;
