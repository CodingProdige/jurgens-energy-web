ALTER TABLE "product_variants"
  ALTER COLUMN "weight_grams" TYPE numeric(12, 3) USING "weight_grams"::numeric(12, 3),
  ALTER COLUMN "length_mm" TYPE numeric(12, 3) USING "length_mm"::numeric(12, 3),
  ALTER COLUMN "width_mm" TYPE numeric(12, 3) USING "width_mm"::numeric(12, 3),
  ALTER COLUMN "height_mm" TYPE numeric(12, 3) USING "height_mm"::numeric(12, 3);
--> statement-breakpoint
ALTER TABLE "shipment_parcels"
  ALTER COLUMN "weight_grams" TYPE numeric(12, 3) USING "weight_grams"::numeric(12, 3),
  ALTER COLUMN "length_mm" TYPE numeric(12, 3) USING "length_mm"::numeric(12, 3),
  ALTER COLUMN "width_mm" TYPE numeric(12, 3) USING "width_mm"::numeric(12, 3),
  ALTER COLUMN "height_mm" TYPE numeric(12, 3) USING "height_mm"::numeric(12, 3);
