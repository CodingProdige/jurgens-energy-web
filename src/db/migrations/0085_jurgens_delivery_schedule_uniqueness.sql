DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "jurgens_delivery_schedules"
    GROUP BY "order_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one Jurgens delivery schedule per order: duplicate order schedules require manual review.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "jurgens_delivery_schedules"
    WHERE "shipment_id" IS NOT NULL
    GROUP BY "shipment_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one Jurgens delivery schedule per shipment: duplicate shipment schedules require manual review.';
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "jurgens_delivery_schedules_order_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "jurgens_delivery_schedules_shipment_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jurgens_delivery_schedules_order_id_unique"
  ON "jurgens_delivery_schedules" ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jurgens_delivery_schedules_shipment_id_unique"
  ON "jurgens_delivery_schedules" ("shipment_id")
  WHERE "shipment_id" IS NOT NULL;
