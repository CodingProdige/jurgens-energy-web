ALTER TABLE "notification_dispatch_claims"
  ADD COLUMN IF NOT EXISTS "claim_token" uuid;
--> statement-breakpoint
UPDATE "notification_dispatch_claims"
SET "claim_token" = gen_random_uuid()
WHERE "claim_token" IS NULL;
--> statement-breakpoint
ALTER TABLE "notification_dispatch_claims"
  ALTER COLUMN "claim_token" SET NOT NULL;
