ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "digital_source_type" varchar(80);
