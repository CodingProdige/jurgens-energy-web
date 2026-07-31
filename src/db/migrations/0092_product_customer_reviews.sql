ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "variant_id" uuid,
  ADD COLUMN IF NOT EXISTS "order_id" uuid,
  ADD COLUMN IF NOT EXISTS "order_item_id" uuid,
  ADD COLUMN IF NOT EXISTS "customer_display_name" varchar(120),
  ADD COLUMN IF NOT EXISTS "title" varchar(140),
  ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_verified_purchase" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "moderated_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp,
  ADD COLUMN IF NOT EXISTS "rejected_reason" text,
  ADD COLUMN IF NOT EXISTS "hidden_at" timestamp,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_variant_id_product_variants_id_fk'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_variant_id_product_variants_id_fk"
      FOREIGN KEY ("variant_id")
      REFERENCES "product_variants"("id")
      ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_order_id_orders_id_fk"
      FOREIGN KEY ("order_id")
      REFERENCES "orders"("id")
      ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_order_item_id_order_items_id_fk'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk"
      FOREIGN KEY ("order_item_id")
      REFERENCES "order_items"("id")
      ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_moderated_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_moderated_by_user_id_users_id_fk"
      FOREIGN KEY ("moderated_by_user_id")
      REFERENCES "users"("id")
      ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "reviews"
  DROP CONSTRAINT IF EXISTS "reviews_rating_range_check",
  ADD CONSTRAINT "reviews_rating_range_check"
    CHECK ("rating" BETWEEN 1 AND 5),
  DROP CONSTRAINT IF EXISTS "reviews_status_check",
  ADD CONSTRAINT "reviews_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'hidden'));
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_order_item_user_id_unique'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_order_item_user_id_unique"
      UNIQUE ("order_item_id", "user_id");
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_product_status_idx"
  ON "reviews" ("product_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_status_created_at_idx"
  ON "reviews" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_user_order_idx"
  ON "reviews" ("user_id", "order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_variant_id_idx"
  ON "reviews" ("variant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_review_summaries" (
  "product_id" uuid PRIMARY KEY REFERENCES "products"("id") ON DELETE cascade,
  "average_rating" numeric(3,2) DEFAULT '0' NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "rating_count_1" integer DEFAULT 0 NOT NULL,
  "rating_count_2" integer DEFAULT 0 NOT NULL,
  "rating_count_3" integer DEFAULT 0 NOT NULL,
  "rating_count_4" integer DEFAULT 0 NOT NULL,
  "rating_count_5" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "product_review_summaries" (
  "product_id",
  "average_rating",
  "review_count",
  "rating_count_1",
  "rating_count_2",
  "rating_count_3",
  "rating_count_4",
  "rating_count_5",
  "updated_at"
)
SELECT
  "product_id",
  COALESCE(ROUND(AVG("rating")::numeric, 2), 0),
  COUNT(*)::int,
  COUNT(*) FILTER (WHERE "rating" = 1)::int,
  COUNT(*) FILTER (WHERE "rating" = 2)::int,
  COUNT(*) FILTER (WHERE "rating" = 3)::int,
  COUNT(*) FILTER (WHERE "rating" = 4)::int,
  COUNT(*) FILTER (WHERE "rating" = 5)::int,
  now()
FROM "reviews"
WHERE "status" = 'approved'
GROUP BY "product_id"
ON CONFLICT ("product_id") DO UPDATE
SET
  "average_rating" = EXCLUDED."average_rating",
  "review_count" = EXCLUDED."review_count",
  "rating_count_1" = EXCLUDED."rating_count_1",
  "rating_count_2" = EXCLUDED."rating_count_2",
  "rating_count_3" = EXCLUDED."rating_count_3",
  "rating_count_4" = EXCLUDED."rating_count_4",
  "rating_count_5" = EXCLUDED."rating_count_5",
  "updated_at" = EXCLUDED."updated_at";
--> statement-breakpoint
INSERT INTO "in_app_notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "surface",
  "type",
  "status",
  "title_template",
  "body_template",
  "action_label_template",
  "action_url_template",
  "required_variables",
  "updated_at"
)
VALUES (
  'admin.customer_product_review.submitted',
  'Admin customer product review submitted',
  'catalog',
  'Shown to catalog administrators when a customer submits a product review.',
  'admin',
  'product_review',
  'active',
  'New product review',
  '{{customer_name}} rated {{product_title}} {{rating}}/5',
  'Moderate reviews',
  '/products/reviews',
  '["customer_name","product_title","rating"]',
  now()
)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_delivery_policies" (
  "event_key",
  "in_app_enabled",
  "email_enabled",
  "push_enabled",
  "priority",
  "quiet_hours_enabled",
  "digest_eligible",
  "created_at",
  "updated_at"
)
VALUES (
  'admin.customer_product_review.submitted',
  true,
  false,
  false,
  'normal',
  false,
  false,
  now(),
  now()
)
ON CONFLICT ("event_key") DO UPDATE
SET
  "in_app_enabled" = EXCLUDED."in_app_enabled",
  "email_enabled" = EXCLUDED."email_enabled",
  "push_enabled" = EXCLUDED."push_enabled",
  "priority" = EXCLUDED."priority",
  "digest_eligible" = EXCLUDED."digest_eligible",
  "updated_at" = now();
