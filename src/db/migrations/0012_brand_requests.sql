CREATE TABLE IF NOT EXISTS "brand_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid,
  "requested_by_user_id" uuid,
  "brand_id" uuid,
  "brand_name" varchar(160) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "website_url" text,
  "notes" text,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_requests_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "brand_requests"
      ADD CONSTRAINT "brand_requests_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_requests_requested_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "brand_requests"
      ADD CONSTRAINT "brand_requests_requested_by_user_id_users_id_fk"
      FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_requests_brand_id_brands_id_fk'
  ) THEN
    ALTER TABLE "brand_requests"
      ADD CONSTRAINT "brand_requests_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_requests_reviewed_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "brand_requests"
      ADD CONSTRAINT "brand_requests_reviewed_by_user_id_users_id_fk"
      FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brand_requests_seller_id_slug_unique" ON "brand_requests" ("seller_id", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_requests_status_idx" ON "brand_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_requests_slug_idx" ON "brand_requests" ("slug");
