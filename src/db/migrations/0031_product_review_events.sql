CREATE TABLE IF NOT EXISTS "product_review_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "from_status" "product_status",
  "to_status" "product_status" NOT NULL,
  "action" varchar(64) NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_review_events_product_id_products_id_fk'
  ) THEN
    ALTER TABLE "product_review_events"
      ADD CONSTRAINT "product_review_events_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_review_events_actor_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "product_review_events"
      ADD CONSTRAINT "product_review_events_actor_user_id_users_id_fk"
      FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_review_events_actor_user_id_idx" ON "product_review_events" ("actor_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_review_events_product_id_idx" ON "product_review_events" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_review_events_product_created_idx" ON "product_review_events" ("product_id", "created_at");
