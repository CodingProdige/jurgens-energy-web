ALTER TABLE "media"
  ADD COLUMN "preview_relative_path" text;
--> statement-breakpoint
ALTER TABLE "media"
  ADD COLUMN "preview_byte_size" integer;
