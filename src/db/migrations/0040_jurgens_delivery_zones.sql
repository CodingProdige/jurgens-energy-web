CREATE TABLE IF NOT EXISTS "jurgens_delivery_zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "postal_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "minimum_order_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
  "delivery_information" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jurgens_delivery_zone_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "zone_id" uuid NOT NULL,
  "from_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
  "up_to_amount" numeric(12, 2),
  "price" numeric(12, 2) DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jurgens_delivery_zone_rates" ADD CONSTRAINT "jurgens_zone_rates_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."jurgens_delivery_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_zones_active_idx" ON "jurgens_delivery_zones" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_zones_sort_idx" ON "jurgens_delivery_zones" ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_zone_rates_zone_id_idx" ON "jurgens_delivery_zone_rates" ("zone_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_zone_rates_zone_sort_idx" ON "jurgens_delivery_zone_rates" ("zone_id","sort_order");
