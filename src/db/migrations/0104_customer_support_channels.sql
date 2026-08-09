ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "tidio_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "tidio_public_key" text,
  ADD COLUMN IF NOT EXISTS "storefront_support_provider" varchar(16) DEFAULT 'off' NOT NULL;
--> statement-breakpoint
UPDATE "marketplace_settings"
SET "storefront_support_provider" = 'whatsapp'
WHERE "whatsapp_ordering_enabled" = true
  AND "storefront_support_provider" = 'off';
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "marketplace_settings"
    ADD CONSTRAINT "marketplace_settings_storefront_support_provider_check"
    CHECK ("storefront_support_provider" IN ('off', 'whatsapp', 'tidio'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "marketplace_settings"
    ADD CONSTRAINT "marketplace_settings_tidio_public_key_check"
    CHECK (
      "tidio_public_key" IS NULL
      OR "tidio_public_key" ~ '^[a-z0-9]{32}$'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "display_name" varchar(160) NOT NULL,
  "role_title" varchar(160),
  "bio" text,
  "public_email" varchar(254),
  "public_phone" varchar(40),
  "public_whatsapp" varchar(40),
  "photo_media_id" uuid,
  "availability" varchar(240),
  "is_published" boolean DEFAULT false NOT NULL,
  "show_in_footer" boolean DEFAULT false NOT NULL,
  "show_on_about" boolean DEFAULT false NOT NULL,
  "show_on_support" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "support_agents_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "support_agents_photo_media_id_media_id_fk"
    FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "support_agents_sort_order_nonnegative_check"
    CHECK ("sort_order" >= 0),
  CONSTRAINT "support_agents_public_placement_contact_check"
    CHECK (
      "is_published" = false
      OR ("show_in_footer" = false AND "show_on_about" = false AND "show_on_support" = false)
      OR NULLIF(BTRIM("public_email"), '') IS NOT NULL
      OR NULLIF(BTRIM("public_phone"), '') IS NOT NULL
      OR NULLIF(BTRIM("public_whatsapp"), '') IS NOT NULL
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_agents_placement_order_idx"
  ON "support_agents" ("is_published", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_agents_user_id_idx"
  ON "support_agents" ("user_id");
