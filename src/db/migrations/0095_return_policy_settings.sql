ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_policy_url" text DEFAULT 'https://jurgensenergy.com/returns-and-refunds' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_country_codes" jsonb DEFAULT '["ZA"]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_acceptance" varchar(40) DEFAULT 'defective_and_non_defective' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_exchanges_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_product_condition" varchar(40) DEFAULT 'only_new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_window_days" integer DEFAULT 7 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_method_codes" jsonb DEFAULT '["by_post"]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_currency_code" varchar(3) DEFAULT 'ZAR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_label_responsibility" varchar(40) DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_restocking_fee_type" varchar(40) DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_restocking_fee_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_restocking_fee_percent" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_refund_processing_days" integer DEFAULT 7 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "returns_hazardous_goods_note_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_settings_returns_policy_url_valid'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_returns_policy_url_valid"
      CHECK ("returns_policy_url" ~ '^https://.+' AND length("returns_policy_url") <= 500);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_settings_returns_window_days_valid'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_returns_window_days_valid"
      CHECK ("returns_window_days" >= 1 AND "returns_window_days" <= 365);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_settings_returns_refund_processing_days_valid'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_returns_refund_processing_days_valid"
      CHECK ("returns_refund_processing_days" >= 0 AND "returns_refund_processing_days" <= 60);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_settings_returns_restocking_amount_valid'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_returns_restocking_amount_valid"
      CHECK ("returns_restocking_fee_amount" IS NULL OR "returns_restocking_fee_amount" >= 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_settings_returns_restocking_percent_valid'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_returns_restocking_percent_valid"
      CHECK ("returns_restocking_fee_percent" IS NULL OR ("returns_restocking_fee_percent" >= 0 AND "returns_restocking_fee_percent" <= 100));
  END IF;
END $$;
