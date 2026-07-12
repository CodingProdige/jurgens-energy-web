ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "order_number" varchar(32);
--> statement-breakpoint
UPDATE "orders"
SET "order_number" = 'JE-' || upper(substr(replace("id"::text, '-', ''), 1, 12))
WHERE "order_number" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "order_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_unique"
  ON "orders" ("order_number");
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_name" text;
--> statement-breakpoint
UPDATE "orders"
SET "customer_name" = 'Customer'
WHERE "customer_name" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "customer_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_email" varchar(254);
--> statement-breakpoint
UPDATE "orders"
SET "customer_email" = 'unknown+' || substr(replace("id"::text, '-', ''), 1, 12) || '@example.invalid'
WHERE "customer_email" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "customer_email" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_phone" varchar(40);
--> statement-breakpoint
UPDATE "orders"
SET "customer_phone" = 'unknown'
WHERE "customer_phone" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "customer_phone" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_address_snapshot" jsonb;
--> statement-breakpoint
UPDATE "orders"
SET "delivery_address_snapshot" = '{}'::jsonb
WHERE "delivery_address_snapshot" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "delivery_address_snapshot" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "checkout_token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'ZAR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
--> statement-breakpoint
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "provider_payment_id" varchar(160);
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "provider_status" varchar(80);
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "raw_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_id_unique"
  ON "payments" ("provider", "provider_payment_id");
--> statement-breakpoint
ALTER TABLE "shipping_rate_quotes"
  ADD COLUMN IF NOT EXISTS "checkout_fingerprint" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_rate_quotes_checkout_fingerprint_idx"
  ON "shipping_rate_quotes" ("checkout_fingerprint");
--> statement-breakpoint
INSERT INTO "notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "status",
  "subject",
  "preview_text",
  "html_body",
  "text_body",
  "required_variables"
)
VALUES (
  'customer_order_paid',
  'Customer order payment confirmation',
  'orders',
  'Sent to a customer after PayFast confirms payment for an order.',
  'active',
  'Payment confirmed for {{order_number}}',
  'Your Jurgens Energy order has been paid successfully.',
  '<h1>Payment confirmed</h1><p>Hi {{customer_name}},</p><p>We received payment for order <strong>{{order_number}}</strong>.</p><p>Order total: <strong>{{order_total}}</strong></p>',
  'Hi {{customer_name}},\n\nWe received payment for order {{order_number}}.\nOrder total: {{order_total}}',
  '["customer_name","order_number","order_total"]'
)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_delivery_policies" (
  "event_key",
  "in_app_enabled",
  "email_enabled",
  "push_enabled",
  "priority",
  "quiet_hours_enabled",
  "digest_eligible"
)
VALUES (
  'customer_order_paid',
  false,
  true,
  false,
  'high',
  false,
  false
)
ON CONFLICT ("event_key") DO NOTHING;
