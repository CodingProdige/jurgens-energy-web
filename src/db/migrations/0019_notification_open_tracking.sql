ALTER TABLE "notification_deliveries"
  ADD COLUMN IF NOT EXISTS "open_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "opened_at" timestamp;

CREATE INDEX IF NOT EXISTS "notification_deliveries_opened_at_idx"
  ON "notification_deliveries" ("opened_at");
