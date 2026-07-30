ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "checkout_request_id" uuid,
  ADD COLUMN IF NOT EXISTS "checkout_request_fingerprint" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_checkout_request_id_unique"
  ON "orders" ("checkout_request_id")
  WHERE "checkout_request_id" IS NOT NULL;
