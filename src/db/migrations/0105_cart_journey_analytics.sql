ALTER TYPE "checkout_analytics_event_name"
  ADD VALUE IF NOT EXISTS 'add_to_cart' BEFORE 'started';
--> statement-breakpoint
ALTER TABLE "checkout_analytics_sessions"
  ADD COLUMN IF NOT EXISTS "cart_started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "checkout_started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_cart_activity_at" timestamp;
--> statement-breakpoint
UPDATE "checkout_analytics_sessions"
SET "checkout_started_at" = "first_seen_at"
WHERE "checkout_started_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_cart_started_at_idx"
  ON "checkout_analytics_sessions" ("cart_started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_checkout_started_at_idx"
  ON "checkout_analytics_sessions" ("checkout_started_at");
--> statement-breakpoint
ALTER TABLE "checkout_analytics_events"
  ADD COLUMN IF NOT EXISTS "product_id" uuid,
  ADD COLUMN IF NOT EXISTS "variant_id" uuid,
  ADD COLUMN IF NOT EXISTS "product_title_snapshot" varchar(240),
  ADD COLUMN IF NOT EXISTS "variant_title_snapshot" varchar(180),
  ADD COLUMN IF NOT EXISTS "brand_name_snapshot" varchar(160),
  ADD COLUMN IF NOT EXISTS "quantity_delta" integer;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "checkout_analytics_events"
    ADD CONSTRAINT "checkout_analytics_events_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "checkout_analytics_events"
    ADD CONSTRAINT "checkout_analytics_events_variant_id_product_variants_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "checkout_analytics_events"
    ADD CONSTRAINT "checkout_analytics_events_quantity_delta_positive_check"
    CHECK ("quantity_delta" IS NULL OR "quantity_delta" > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_events_product_id_occurred_at_idx"
  ON "checkout_analytics_events" ("product_id", "occurred_at");
