ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_ups_enabled" boolean DEFAULT true NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_delay_minutes" integer DEFAULT 30 NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_max_count" integer DEFAULT 1 NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_quiet_hours_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_quiet_hours_start" varchar(5);

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_quiet_hours_end" varchar(5);

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_draft_message" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_support_message" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_follow_up_default_message" text;
