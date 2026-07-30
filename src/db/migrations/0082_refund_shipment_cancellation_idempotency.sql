ALTER TABLE "refund_shipment_cancellation_jobs"
  DROP CONSTRAINT IF EXISTS "refund_shipment_cancellation_jobs_refund_shipment_unique";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'refund_shipment_cancellation_jobs_shipment_unique'
  ) THEN
    ALTER TABLE "refund_shipment_cancellation_jobs"
      ADD CONSTRAINT "refund_shipment_cancellation_jobs_shipment_unique"
      UNIQUE ("shipment_id");
  END IF;
END $$;
