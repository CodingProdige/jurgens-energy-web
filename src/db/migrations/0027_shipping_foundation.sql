DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_fulfillment_mode') THEN
    CREATE TYPE "product_fulfillment_mode" AS ENUM ('seller_fulfilled', 'piessang_fulfilled');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_provider') THEN
    CREATE TYPE "shipping_provider" AS ENUM ('manual', 'bobgo', 'piessang_local');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_quote_status') THEN
    CREATE TYPE "shipping_quote_status" AS ENUM ('quoted', 'selected', 'expired', 'booked', 'cancelled');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE "shipment_status" AS ENUM ('pending_booking', 'booked', 'waybill_ready', 'ready_for_collection', 'collected', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "fulfillment_mode" "product_fulfillment_mode" DEFAULT 'seller_fulfilled' NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "weight_grams" integer;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "length_mm" integer;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "width_mm" integer;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "height_mm" integer;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "ships_alone" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "is_fragile" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "shipping_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "shipping_margin_bps" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "shipping_buffer_bps" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "bobgo_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "bobgo_mode" varchar(16) DEFAULT 'sandbox' NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "bobgo_api_key_encrypted" text;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "bobgo_webhook_secret_encrypted" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_shipping_dimensions_positive_check'
  ) THEN
    ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_shipping_dimensions_positive_check"
      CHECK (
        ("weight_grams" IS NULL OR "weight_grams" > 0)
        AND ("length_mm" IS NULL OR "length_mm" > 0)
        AND ("width_mm" IS NULL OR "width_mm" > 0)
        AND ("height_mm" IS NULL OR "height_mm" > 0)
      );
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_settings_shipping_margin_bps_check'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_shipping_margin_bps_check"
      CHECK ("shipping_margin_bps" >= 0 AND "shipping_margin_bps" <= 10000);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_settings_shipping_buffer_bps_check'
  ) THEN
    ALTER TABLE "marketplace_settings"
      ADD CONSTRAINT "marketplace_settings_shipping_buffer_bps_check"
      CHECK ("shipping_buffer_bps" >= 0 AND "shipping_buffer_bps" <= 10000);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_fulfillment_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL,
  "contact_name" varchar(160) NOT NULL,
  "contact_phone" varchar(40) NOT NULL,
  "contact_email" varchar(254) NOT NULL,
  "address_type" varchar(32) DEFAULT 'business' NOT NULL,
  "address_line_1" varchar(240) NOT NULL,
  "address_line_2" varchar(240),
  "suburb" varchar(120) NOT NULL,
  "city" varchar(120) NOT NULL,
  "province" varchar(120) NOT NULL,
  "postal_code" varchar(40) NOT NULL,
  "country_code" varchar(2) DEFAULT 'ZA' NOT NULL,
  "collection_instructions" text,
  "is_verified" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipping_rate_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid,
  "seller_id" uuid NOT NULL,
  "provider" "shipping_provider" NOT NULL,
  "status" "shipping_quote_status" DEFAULT 'quoted' NOT NULL,
  "provider_rate_id" text,
  "service_name" varchar(160) NOT NULL,
  "service_level" varchar(120),
  "currency" varchar(3) DEFAULT 'ZAR' NOT NULL,
  "provider_amount" numeric(12, 2) NOT NULL,
  "customer_amount" numeric(12, 2) NOT NULL,
  "margin_amount" numeric(12, 2) NOT NULL,
  "margin_bps" integer DEFAULT 0 NOT NULL,
  "buffer_bps" integer DEFAULT 0 NOT NULL,
  "collection_address_snapshot" jsonb NOT NULL,
  "delivery_address_snapshot" jsonb NOT NULL,
  "parcel_snapshot" jsonb NOT NULL,
  "provider_payload" jsonb,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "quote_id" uuid,
  "provider" "shipping_provider" NOT NULL,
  "status" "shipment_status" DEFAULT 'pending_booking' NOT NULL,
  "provider_shipment_id" text,
  "waybill_number" varchar(160),
  "tracking_number" varchar(160),
  "tracking_url" text,
  "waybill_url" text,
  "booked_at" timestamp,
  "collected_at" timestamp,
  "delivered_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_parcels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shipment_id" uuid NOT NULL,
  "weight_grams" integer NOT NULL,
  "length_mm" integer NOT NULL,
  "width_mm" integer NOT NULL,
  "height_mm" integer NOT NULL,
  "declared_value" numeric(12, 2),
  "reference" varchar(160)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shipment_id" uuid NOT NULL,
  "provider" "shipping_provider" NOT NULL,
  "provider_event_id" text,
  "status" varchar(120) NOT NULL,
  "message" text,
  "location" varchar(180),
  "occurred_at" timestamp NOT NULL,
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_fulfillment_profiles_seller_id_unique'
  ) THEN
    ALTER TABLE "seller_fulfillment_profiles"
      ADD CONSTRAINT "seller_fulfillment_profiles_seller_id_unique"
      UNIQUE ("seller_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_fulfillment_profiles_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "seller_fulfillment_profiles"
      ADD CONSTRAINT "seller_fulfillment_profiles_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_rate_quotes_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "shipping_rate_quotes"
      ADD CONSTRAINT "shipping_rate_quotes_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_rate_quotes_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipping_rate_quotes"
      ADD CONSTRAINT "shipping_rate_quotes_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipments_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipments_seller_id_sellers_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipments_quote_id_shipping_rate_quotes_id_fk'
  ) THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_quote_id_shipping_rate_quotes_id_fk"
      FOREIGN KEY ("quote_id") REFERENCES "public"."shipping_rate_quotes"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipment_parcels_shipment_id_shipments_id_fk'
  ) THEN
    ALTER TABLE "shipment_parcels"
      ADD CONSTRAINT "shipment_parcels_shipment_id_shipments_id_fk"
      FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipment_events_shipment_id_shipments_id_fk'
  ) THEN
    ALTER TABLE "shipment_events"
      ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk"
      FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipment_parcels_dimensions_positive_check'
  ) THEN
    ALTER TABLE "shipment_parcels"
      ADD CONSTRAINT "shipment_parcels_dimensions_positive_check"
      CHECK (
        "weight_grams" > 0
        AND "length_mm" > 0
        AND "width_mm" > 0
        AND "height_mm" > 0
      );
  END IF;
END $$;
