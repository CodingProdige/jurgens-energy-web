ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_automated_responses_enabled" boolean DEFAULT true NOT NULL;
