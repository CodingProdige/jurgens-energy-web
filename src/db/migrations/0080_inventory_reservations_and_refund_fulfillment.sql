ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_expires_at" timestamp;
--> statement-breakpoint
UPDATE "orders"
SET "payment_expires_at" = "created_at" + interval '30 minutes'
WHERE "status" = 'pending'
  AND "payment_expires_at" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pending_payment_expiry_check'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_pending_payment_expiry_check"
      CHECK ("status" <> 'pending' OR "payment_expires_at" IS NOT NULL);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_payment_expires_idx"
  ON "orders" ("status", "payment_expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE restrict,
  "quantity" integer NOT NULL,
  "stock_quantity" integer NOT NULL,
  "status" varchar(24) DEFAULT 'reserved' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "released_at" timestamp,
  "release_reason" varchar(80),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_reservations_order_variant_unique"
    UNIQUE("order_id", "variant_id"),
  CONSTRAINT "inventory_reservations_quantity_positive_check"
    CHECK ("quantity" > 0),
  CONSTRAINT "inventory_reservations_stock_quantity_check"
    CHECK ("stock_quantity" >= 0 AND "stock_quantity" <= "quantity"),
  CONSTRAINT "inventory_reservations_status_check"
    CHECK ("status" IN ('reserved', 'consumed', 'released'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_reservations_status_expires_idx"
  ON "inventory_reservations" ("status", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_reservations_variant_id_idx"
  ON "inventory_reservations" ("variant_id");
--> statement-breakpoint
ALTER TABLE "payment_refunds"
  ADD COLUMN IF NOT EXISTS "requested_restock_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "cancel_open_shipments" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refund_inventory_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "refund_id" uuid NOT NULL REFERENCES "payment_refunds"("id") ON DELETE restrict,
  "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE restrict,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE restrict,
  "quantity" integer NOT NULL,
  "applied_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "refund_inventory_adjustments_refund_order_item_unique"
    UNIQUE("refund_id", "order_item_id"),
  CONSTRAINT "refund_inventory_adjustments_quantity_positive_check"
    CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_inventory_adjustments_refund_id_idx"
  ON "refund_inventory_adjustments" ("refund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_inventory_adjustments_variant_id_idx"
  ON "refund_inventory_adjustments" ("variant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refund_shipment_cancellation_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "refund_id" uuid NOT NULL REFERENCES "payment_refunds"("id") ON DELETE restrict,
  "shipment_id" uuid NOT NULL REFERENCES "shipments"("id") ON DELETE restrict,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "last_error" text,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "refund_shipment_cancellation_jobs_refund_shipment_unique"
    UNIQUE("refund_id", "shipment_id"),
  CONSTRAINT "refund_shipment_cancellation_jobs_status_check"
    CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'manual_review'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_shipment_cancellation_jobs_status_available_idx"
  ON "refund_shipment_cancellation_jobs" ("status", "available_at");
