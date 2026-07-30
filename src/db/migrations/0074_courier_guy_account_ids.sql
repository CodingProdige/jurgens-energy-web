ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "courier_guy_live_account_id" integer,
  ADD COLUMN IF NOT EXISTS "courier_guy_sandbox_account_id" integer;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_live_account_id_positive",
  ADD CONSTRAINT "marketplace_settings_courier_guy_live_account_id_positive"
    CHECK (
      "courier_guy_live_account_id" IS NULL
      OR "courier_guy_live_account_id" > 0
    ),
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_sandbox_account_id_positive",
  ADD CONSTRAINT "marketplace_settings_courier_guy_sandbox_account_id_positive"
    CHECK (
      "courier_guy_sandbox_account_id" IS NULL
      OR "courier_guy_sandbox_account_id" > 0
    );
