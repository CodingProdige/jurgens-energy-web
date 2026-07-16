CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "label" varchar(80) NOT NULL,
  "recipient_name" varchar(160) NOT NULL,
  "recipient_phone" varchar(40) NOT NULL,
  "address_line_1" varchar(240) NOT NULL,
  "address_line_2" varchar(240),
  "suburb" varchar(120) NOT NULL,
  "city" varchar(120) NOT NULL,
  "province" varchar(120) NOT NULL,
  "postal_code" varchar(40) NOT NULL,
  "country_code" varchar(2) DEFAULT 'ZA' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_addresses_user_id_idx"
  ON "customer_addresses" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_addresses_user_last_used_idx"
  ON "customer_addresses" ("user_id", "last_used_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_addresses_user_default_unique"
  ON "customer_addresses" ("user_id")
  WHERE "is_default" = true;
