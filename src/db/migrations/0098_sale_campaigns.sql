DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'sale_campaign_status'
  ) THEN
    CREATE TYPE "sale_campaign_status" AS ENUM ('active', 'ended');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'sale_campaign_variant_status'
  ) THEN
    CREATE TYPE "sale_campaign_variant_status" AS ENUM ('active', 'ended');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "badge_text" varchar(80) DEFAULT 'Sale' NOT NULL,
  "discount_percent" numeric(5, 2) NOT NULL,
  "status" "sale_campaign_status" DEFAULT 'active' NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_campaign_variants" (
  "campaign_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "status" "sale_campaign_variant_status" DEFAULT 'active' NOT NULL,
  "original_price" numeric(12, 2) NOT NULL,
  "original_compare_at_price" numeric(12, 2),
  "sale_price" numeric(12, 2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sale_campaign_variants_campaign_id_variant_id_pk"
    PRIMARY KEY ("campaign_id", "variant_id")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_campaigns_created_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "sale_campaigns"
      ADD CONSTRAINT "sale_campaigns_created_by_user_id_users_id_fk"
      FOREIGN KEY ("created_by_user_id")
      REFERENCES "users"("id")
      ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_campaign_variants_campaign_id_sale_campaigns_id_fk'
  ) THEN
    ALTER TABLE "sale_campaign_variants"
      ADD CONSTRAINT "sale_campaign_variants_campaign_id_sale_campaigns_id_fk"
      FOREIGN KEY ("campaign_id")
      REFERENCES "sale_campaigns"("id")
      ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_campaign_variants_variant_id_product_variants_id_fk'
  ) THEN
    ALTER TABLE "sale_campaign_variants"
      ADD CONSTRAINT "sale_campaign_variants_variant_id_product_variants_id_fk"
      FOREIGN KEY ("variant_id")
      REFERENCES "product_variants"("id")
      ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaigns_created_at_idx"
  ON "sale_campaigns" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaigns_status_idx"
  ON "sale_campaigns" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaign_variants_campaign_id_idx"
  ON "sale_campaign_variants" ("campaign_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sale_campaign_variants_one_active_variant_idx"
  ON "sale_campaign_variants" ("variant_id")
  WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaign_variants_status_idx"
  ON "sale_campaign_variants" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_campaign_variants_variant_id_idx"
  ON "sale_campaign_variants" ("variant_id");
