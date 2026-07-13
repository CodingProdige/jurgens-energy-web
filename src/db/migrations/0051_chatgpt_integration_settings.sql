ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "openai_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "openai_api_key_encrypted" text,
  ADD COLUMN IF NOT EXISTS "openai_model" text DEFAULT 'gpt-5.6-luna' NOT NULL,
  ADD COLUMN IF NOT EXISTS "openai_reasoning_effort" varchar(16) DEFAULT 'medium' NOT NULL;
