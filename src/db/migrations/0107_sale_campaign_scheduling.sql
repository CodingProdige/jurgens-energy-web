ALTER TYPE "sale_campaign_status"
  ADD VALUE IF NOT EXISTS 'scheduled' BEFORE 'active';
--> statement-breakpoint
ALTER TYPE "sale_campaign_variant_status"
  ADD VALUE IF NOT EXISTS 'scheduled' BEFORE 'active';
--> statement-breakpoint
ALTER TABLE "sale_campaigns"
  ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sale_campaigns"
SET
  "starts_at" = COALESCE("starts_at", "created_at" AT TIME ZONE 'UTC'),
  "activated_at" = CASE
    WHEN "status" IN ('active', 'ended')
      THEN COALESCE("activated_at", "created_at" AT TIME ZONE 'UTC')
    ELSE "activated_at"
  END;
--> statement-breakpoint
ALTER TABLE "sale_campaigns"
  ALTER COLUMN "starts_at" SET DEFAULT now(),
  ALTER COLUMN "starts_at" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_campaigns_schedule_window_check'
  ) THEN
    ALTER TABLE "sale_campaigns"
      ADD CONSTRAINT "sale_campaigns_schedule_window_check"
      CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaigns_lifecycle_idx"
  ON "sale_campaigns" ("status", "starts_at", "ends_at");
