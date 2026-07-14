ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "policy_acceptance_snapshot" jsonb;
