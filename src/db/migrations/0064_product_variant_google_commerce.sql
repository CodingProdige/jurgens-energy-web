DO $$
BEGIN
  CREATE TYPE "google_fulfillment_channel" AS ENUM (
    'local_lpg',
    'national_courier',
    'excluded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_variants'
      AND column_name = 'google_fulfillment_channel'
  ) THEN
    ALTER TABLE "product_variants"
      ADD COLUMN "google_fulfillment_channel" "google_fulfillment_channel";

    UPDATE "product_variants" AS variant
    SET "google_fulfillment_channel" = CASE
      WHEN product."fulfillment_mode" = 'seller_fulfilled'
        THEN 'national_courier'::"google_fulfillment_channel"
      ELSE 'local_lpg'::"google_fulfillment_channel"
    END
    FROM "products" AS product
    WHERE product."id" = variant."product_id";

    ALTER TABLE "product_variants"
      ALTER COLUMN "google_fulfillment_channel" SET DEFAULT 'local_lpg',
      ALTER COLUMN "google_fulfillment_channel" SET NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "manufacturer_mpn" varchar(70);
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "google_return_policy_label" varchar(100);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_google_fulfillment_channel_idx"
  ON "product_variants" ("google_fulfillment_channel");
