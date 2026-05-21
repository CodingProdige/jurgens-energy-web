ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_slug_unique";
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "path" varchar(760);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "depth" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "commission_rate_bps" integer;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "categories"
SET "path" = "slug"
WHERE "path" IS NULL;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "path" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_commission_rate_bps_check'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_commission_rate_bps_check"
      CHECK ("commission_rate_bps" IS NULL OR ("commission_rate_bps" >= 0 AND "commission_rate_bps" <= 10000));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_categories_id_fk'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_parent_id_categories_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_path_unique" ON "categories" ("path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories" ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_status_idx" ON "categories" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "description" text,
  "website_url" text,
  "logo_media_id" uuid,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_logo_media_id_media_id_fk'
  ) THEN
    ALTER TABLE "brands"
      ADD CONSTRAINT "brands_logo_media_id_media_id_fk"
      FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brands_slug_unique" ON "brands" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brands_status_idx" ON "brands" ("status");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_id_brands_id_fk'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "commission_rate_bps" integer;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "commission_amount" numeric(12, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_category_id_categories_id_fk'
  ) THEN
    ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_category_id_categories_id_fk"
      FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_brand_id_brands_id_fk'
  ) THEN
    ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
