ALTER TABLE "notification_dispatch_claims"
  DROP CONSTRAINT IF EXISTS "notification_dispatch_claims_status_valid";
--> statement-breakpoint
ALTER TABLE "notification_dispatch_claims"
  ADD CONSTRAINT "notification_dispatch_claims_status_valid"
  CHECK ("status" IN ('pending', 'processing', 'sent', 'failed'));
