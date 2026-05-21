ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "max_video_upload_file_mb" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "max_video_width" integer DEFAULT 1280 NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "video_compression_crf" integer DEFAULT 28 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
