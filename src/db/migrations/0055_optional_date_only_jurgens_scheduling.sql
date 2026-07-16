ALTER TABLE "jurgens_delivery_schedules"
  ALTER COLUMN "window_start" DROP NOT NULL,
  ALTER COLUMN "window_end" DROP NOT NULL,
  ALTER COLUMN "window_label" DROP NOT NULL;
