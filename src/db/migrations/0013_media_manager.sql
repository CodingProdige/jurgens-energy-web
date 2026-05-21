CREATE TABLE IF NOT EXISTS "media_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid,
  "seller_id" uuid,
  "name" varchar(120) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_folders_owner_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "media_folders"
      ADD CONSTRAINT "media_folders_owner_user_id_users_id_fk"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_folders_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "media_folders"
      ADD CONSTRAINT "media_folders_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "folder_id" uuid;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "original_file_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "thumbnail_relative_path" text;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "original_mime_type" varchar(120);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "original_byte_size" integer;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "width" integer;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "height" integer;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "content_hash" varchar(128);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tags" text;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_folder_id_media_folders_id_fk'
  ) THEN
    ALTER TABLE "media"
      ADD CONSTRAINT "media_folder_id_media_folders_id_fk"
      FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_folder_id_idx" ON "media" ("folder_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_owner_user_id_idx" ON "media" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_seller_id_idx" ON "media" ("seller_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_content_hash_idx" ON "media" ("content_hash");
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "free_storage_quota_mb" integer DEFAULT 512 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "premium_storage_quota_mb" integer DEFAULT 5120 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "max_upload_file_mb" integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "image_compression_quality" integer DEFAULT 78 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "max_image_width" integer DEFAULT 2000 NOT NULL;
