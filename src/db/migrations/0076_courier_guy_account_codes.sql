ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "courier_guy_live_account_code" varchar(64),
  ADD COLUMN IF NOT EXISTS "courier_guy_sandbox_account_code" varchar(64);
--> statement-breakpoint
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "provider_account_code" varchar(64);
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_live_account_code_valid",
  ADD CONSTRAINT "marketplace_settings_courier_guy_live_account_code_valid"
    CHECK (
      "courier_guy_live_account_code" IS NULL
      OR btrim("courier_guy_live_account_code") <> ''
    ),
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_sandbox_account_code_valid",
  ADD CONSTRAINT "marketplace_settings_courier_guy_sandbox_account_code_valid"
    CHECK (
      "courier_guy_sandbox_account_code" IS NULL
      OR btrim("courier_guy_sandbox_account_code") <> ''
    );
--> statement-breakpoint
ALTER TABLE "shipments"
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_account_code_valid",
  ADD CONSTRAINT "shipments_courier_guy_account_code_valid"
    CHECK (
      "provider_account_code" IS NULL
      OR btrim("provider_account_code") <> ''
    );
