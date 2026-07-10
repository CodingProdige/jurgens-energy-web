ALTER TABLE "products" ALTER COLUMN "seller_id" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "products"
      DROP CONSTRAINT "products_seller_id_sellers_id_fk";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END $$;
