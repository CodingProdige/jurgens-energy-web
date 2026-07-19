ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "cost_price" numeric(12, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_cost_price_non_negative_check'
  ) THEN
    ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_cost_price_non_negative_check"
      CHECK ("cost_price" IS NULL OR "cost_price" >= 0);
  END IF;
END $$;
