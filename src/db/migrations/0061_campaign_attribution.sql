ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "campaign_attribution_snapshot" jsonb;
