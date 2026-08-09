DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'courier_guy_packing_plan_status'
  ) THEN
    CREATE TYPE "courier_guy_packing_plan_status" AS ENUM (
      'draft',
      'confirmed',
      'booking',
      'reconciliation_required',
      'booked'
    );
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'courier_guy_booking_batch_status'
  ) THEN
    CREATE TYPE "courier_guy_booking_batch_status" AS ENUM (
      'quoted',
      'booking',
      'partially_booked',
      'needs_reconciliation',
      'booked',
      'expired',
      'failed'
    );
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'courier_guy_booking_batch_item_status'
  ) THEN
    CREATE TYPE "courier_guy_booking_batch_item_status" AS ENUM (
      'quoted',
      'queued',
      'attempting',
      'booked',
      'failed',
      'needs_reconciliation',
      'released'
    );
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courier_guy_packing_plans" (
  "order_id" uuid PRIMARY KEY NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "status" "courier_guy_packing_plan_status" DEFAULT 'draft' NOT NULL,
  "confirmed_at" timestamp,
  "confirmed_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_packing_plans_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_packing_plans"
      ADD CONSTRAINT "courier_guy_packing_plans_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_packing_plans_confirmed_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_packing_plans"
      ADD CONSTRAINT "courier_guy_packing_plans_confirmed_by_user_id_users_id_fk"
      FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_packing_plans_revision_nonnegative'
  ) THEN
    ALTER TABLE "courier_guy_packing_plans"
      ADD CONSTRAINT "courier_guy_packing_plans_revision_nonnegative"
      CHECK ("revision" >= 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_packing_plans_status_idx"
  ON "courier_guy_packing_plans" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "package_sequence" integer,
  ADD COLUMN IF NOT EXISTS "packing_plan_revision" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipments_package_sequence_positive'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_package_sequence_positive"
      CHECK ("package_sequence" IS NULL OR "package_sequence" > 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipments_packing_plan_revision_positive'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_packing_plan_revision_positive"
      CHECK (
        "packing_plan_revision" IS NULL OR "packing_plan_revision" >= 1
      );
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_courier_guy_order_package_sequence_unique"
  ON "shipments" USING btree ("order_id", "package_sequence")
  WHERE "provider" = 'courier_guy' AND "package_sequence" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipments_courier_guy_order_revision_idx"
  ON "shipments" USING btree (
    "order_id",
    "provider",
    "packing_plan_revision"
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courier_guy_booking_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "packing_revision" integer NOT NULL,
  "status" "courier_guy_booking_batch_status" DEFAULT 'quoted' NOT NULL,
  "currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
  "customer_shipping_amount" numeric(12, 2) NOT NULL,
  "already_committed_provider_amount" numeric(12, 2) NOT NULL,
  "approved_provider_amount" numeric(12, 2) NOT NULL,
  "projected_provider_spend" numeric(12, 2) NOT NULL,
  "projected_absorbed_amount" numeric(12, 2) NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_by_user_id" uuid,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batches_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_booking_batches"
      ADD CONSTRAINT "courier_guy_booking_batches_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batches_created_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_booking_batches"
      ADD CONSTRAINT "courier_guy_booking_batches_created_by_user_id_users_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batches_packing_revision_positive'
  ) THEN
    ALTER TABLE "courier_guy_booking_batches"
      ADD CONSTRAINT "courier_guy_booking_batches_packing_revision_positive"
      CHECK ("packing_revision" >= 1);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batches_amount_nonnegative'
  ) THEN
    ALTER TABLE "courier_guy_booking_batches"
      ADD CONSTRAINT "courier_guy_booking_batches_amount_nonnegative"
      CHECK (
        "customer_shipping_amount" >= 0
        AND "already_committed_provider_amount" >= 0
        AND "approved_provider_amount" >= 0
        AND "projected_provider_spend" >= 0
        AND "projected_absorbed_amount" >= 0
      );
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batches_currency_valid'
  ) THEN
    ALTER TABLE "courier_guy_booking_batches"
      ADD CONSTRAINT "courier_guy_booking_batches_currency_valid"
      CHECK (char_length("currency") = 3);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_booking_batches_order_revision_idx"
  ON "courier_guy_booking_batches" USING btree (
    "order_id",
    "packing_revision"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_booking_batches_status_expiry_idx"
  ON "courier_guy_booking_batches" USING btree ("status", "expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "courier_guy_booking_batches_active_order_revision_unique"
  ON "courier_guy_booking_batches" USING btree (
    "order_id",
    "packing_revision"
  )
  WHERE "status" IN ('quoted', 'booking', 'needs_reconciliation');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courier_guy_booking_batch_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "shipment_id" uuid NOT NULL,
  "quote_id" uuid NOT NULL,
  "package_sequence" integer NOT NULL,
  "status" "courier_guy_booking_batch_item_status" DEFAULT 'quoted' NOT NULL,
  "approved_provider_amount" numeric(12, 2) NOT NULL,
  "provider_cost_amount" numeric(12, 2),
  "last_error" text,
  "attempted_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cg_booking_batch_items_batch_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "cg_booking_batch_items_batch_id_fk"
      FOREIGN KEY ("batch_id") REFERENCES "public"."courier_guy_booking_batches"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_batch_package_sequence_unique'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_batch_package_sequence_unique"
      UNIQUE ("batch_id", "package_sequence");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cg_booking_batch_items_shipment_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "cg_booking_batch_items_shipment_id_fk"
      FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cg_booking_batch_items_quote_id_fk'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "cg_booking_batch_items_quote_id_fk"
      FOREIGN KEY ("quote_id") REFERENCES "public"."shipping_rate_quotes"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_batch_shipment_unique'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_batch_shipment_unique"
      UNIQUE ("batch_id", "shipment_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_quote_id_unique'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_quote_id_unique"
      UNIQUE ("quote_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_package_sequence_positive'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_package_sequence_positive"
      CHECK ("package_sequence" > 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_approved_amount_nonnegative'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_approved_amount_nonnegative"
      CHECK ("approved_provider_amount" >= 0);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courier_guy_booking_batch_items_provider_cost_nonnegative'
  ) THEN
    ALTER TABLE "courier_guy_booking_batch_items"
      ADD CONSTRAINT "courier_guy_booking_batch_items_provider_cost_nonnegative"
      CHECK ("provider_cost_amount" IS NULL OR "provider_cost_amount" >= 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_booking_batch_items_batch_status_idx"
  ON "courier_guy_booking_batch_items" USING btree ("batch_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_guy_booking_batch_items_shipment_id_idx"
  ON "courier_guy_booking_batch_items" USING btree ("shipment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_parcel_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parcel_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipment_parcel_items_parcel_id_fk'
  ) THEN
    ALTER TABLE "shipment_parcel_items"
      ADD CONSTRAINT "shipment_parcel_items_parcel_id_fk"
      FOREIGN KEY ("parcel_id") REFERENCES "public"."shipment_parcels"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipment_parcel_items_order_item_id_fk'
  ) THEN
    ALTER TABLE "shipment_parcel_items"
      ADD CONSTRAINT "shipment_parcel_items_order_item_id_fk"
      FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipment_parcel_items_parcel_order_item_unique'
  ) THEN
    ALTER TABLE "shipment_parcel_items"
      ADD CONSTRAINT "shipment_parcel_items_parcel_order_item_unique"
      UNIQUE ("parcel_id", "order_item_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipment_parcel_items_quantity_positive'
  ) THEN
    ALTER TABLE "shipment_parcel_items"
      ADD CONSTRAINT "shipment_parcel_items_quantity_positive"
      CHECK ("quantity" > 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_parcel_items_parcel_id_idx"
  ON "shipment_parcel_items" USING btree ("parcel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_parcel_items_order_item_id_idx"
  ON "shipment_parcel_items" USING btree ("order_item_id");
--> statement-breakpoint
INSERT INTO "courier_guy_packing_plans" (
  "order_id",
  "revision",
  "status"
)
SELECT DISTINCT
  "order_id",
  0,
  'draft'::"courier_guy_packing_plan_status"
FROM "shipments"
WHERE "provider" = 'courier_guy'
ON CONFLICT ("order_id") DO NOTHING;
