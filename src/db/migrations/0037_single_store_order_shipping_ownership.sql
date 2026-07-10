ALTER TABLE "order_items" ALTER COLUMN "seller_id" DROP NOT NULL;
ALTER TABLE "shipping_rate_quotes" ALTER COLUMN "seller_id" DROP NOT NULL;
ALTER TABLE "shipments" ALTER COLUMN "seller_id" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "order_items"
      DROP CONSTRAINT "order_items_seller_id_sellers_id_fk";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipping_rate_quotes_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipping_rate_quotes"
      DROP CONSTRAINT "shipping_rate_quotes_seller_id_sellers_id_fk";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipments_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      DROP CONSTRAINT "shipments_seller_id_sellers_id_fk";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipping_rate_quotes_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipping_rate_quotes"
      ADD CONSTRAINT "shipping_rate_quotes_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipments_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END $$;
