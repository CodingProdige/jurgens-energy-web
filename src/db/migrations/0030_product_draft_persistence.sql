ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'pending_review';
--> statement-breakpoint
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'changes_requested';
--> statement-breakpoint
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'live';
--> statement-breakpoint
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'paused';
--> statement-breakpoint
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'admin_suspended';
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand_request_id" uuid;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "short_description" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "full_description" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" varchar(120);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "option_schema" jsonb;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option_values" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "compare_at_price" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "low_stock_alert" integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "continue_selling_out_of_stock" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "barcode" varchar(120);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "media_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_request_id_brand_requests_id_fk'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_brand_request_id_brand_requests_id_fk"
      FOREIGN KEY ("brand_request_id") REFERENCES "public"."brand_requests"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_media_id_media_id_fk'
  ) THEN
    ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_media_id_media_id_fk"
      FOREIGN KEY ("media_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_media_id_idx" ON "product_variants" ("media_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_status_idx" ON "product_variants" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_media" (
  "product_id" uuid NOT NULL,
  "media_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_cover" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "product_media_product_id_media_id_pk" PRIMARY KEY("product_id", "media_id")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_media_product_id_products_id_fk'
  ) THEN
    ALTER TABLE "product_media"
      ADD CONSTRAINT "product_media_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_media_media_id_media_id_fk'
  ) THEN
    ALTER TABLE "product_media"
      ADD CONSTRAINT "product_media_media_id_media_id_fk"
      FOREIGN KEY ("media_id") REFERENCES "public"."media"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_media_media_id_idx" ON "product_media" ("media_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_media_product_sort_idx" ON "product_media" ("product_id", "sort_order");
