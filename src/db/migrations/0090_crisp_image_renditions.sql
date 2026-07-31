ALTER TABLE "marketplace_settings"
  ALTER COLUMN "image_compression_quality" SET DEFAULT 90;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ALTER COLUMN "max_image_width" SET DEFAULT 2560;
--> statement-breakpoint
UPDATE "marketplace_settings"
SET
  "image_compression_quality" = 90,
  "updated_at" = now()
WHERE "image_compression_quality" = 78;
--> statement-breakpoint
UPDATE "marketplace_settings"
SET
  "max_image_width" = 2560,
  "updated_at" = now()
WHERE "max_image_width" = 2000;
