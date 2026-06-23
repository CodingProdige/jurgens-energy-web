ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_live_api_key_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_live_webhook_secret_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_sandbox_api_key_encrypted" text;

ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "bobgo_sandbox_webhook_secret_encrypted" text;

UPDATE "marketplace_settings"
SET
  "bobgo_sandbox_api_key_encrypted" = COALESCE(
    "bobgo_sandbox_api_key_encrypted",
    "bobgo_api_key_encrypted"
  ),
  "bobgo_sandbox_webhook_secret_encrypted" = COALESCE(
    "bobgo_sandbox_webhook_secret_encrypted",
    "bobgo_webhook_secret_encrypted"
  )
WHERE "id" = 1;
