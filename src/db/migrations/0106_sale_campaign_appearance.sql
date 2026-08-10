ALTER TABLE "sale_campaigns"
  ADD COLUMN IF NOT EXISTS "public_headline" varchar(200),
  ADD COLUMN IF NOT EXISTS "badge_color" varchar(7) DEFAULT '#FF5A1F' NOT NULL,
  ADD COLUMN IF NOT EXISTS "badge_icon" varchar(80),
  ADD COLUMN IF NOT EXISTS "header_visible" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "header_priority" smallint DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cta_label" varchar(80) DEFAULT 'Shop sale' NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_campaigns_badge_color_check'
  ) THEN
    ALTER TABLE "sale_campaigns"
      ADD CONSTRAINT "sale_campaigns_badge_color_check"
      CHECK ("badge_color" ~ '^#[0-9A-F]{6}$');
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaigns_header_idx"
  ON "sale_campaigns" ("status", "header_visible", "header_priority");
