ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "is_jurgens_fulfillment_enabled" boolean NOT NULL DEFAULT false;
