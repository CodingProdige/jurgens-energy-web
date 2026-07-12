ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "google_review_url" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jurgens_delivery_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "shipment_id" uuid REFERENCES "shipments"("id") ON DELETE set null,
  "quote_id" uuid REFERENCES "shipping_rate_quotes"("id") ON DELETE set null,
  "zone_id" uuid REFERENCES "jurgens_delivery_zones"("id") ON DELETE set null,
  "status" varchar(32) DEFAULT 'scheduled' NOT NULL,
  "scheduled_date" varchar(10) NOT NULL,
  "window_start" varchar(5) NOT NULL,
  "window_end" varchar(5) NOT NULL,
  "window_label" varchar(80) NOT NULL,
  "delivery_instructions" text,
  "last_notified_status" varchar(32),
  "last_notified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_schedules_order_id_idx"
  ON "jurgens_delivery_schedules" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_schedules_shipment_id_idx"
  ON "jurgens_delivery_schedules" ("shipment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurgens_delivery_schedules_date_status_idx"
  ON "jurgens_delivery_schedules" ("scheduled_date", "status");
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
  'customer_jurgens_delivery_update',
  'Customer Jurgens delivery update',
  'orders',
  'Sent to customers when a Jurgens Energy direct delivery changes status.',
  'active',
  'Delivery update for {{order_number}}',
  'Your Jurgens Energy delivery status has changed.',
  '<h1>Delivery update</h1><p>Hi {{customer_name}},</p><p>{{status_message}}</p><p><strong>Order:</strong> {{order_number}}<br><strong>Status:</strong> {{delivery_status}}<br><strong>Scheduled:</strong> {{delivery_date}} · {{scheduled_window}}</p><p>{{rating_link}}</p>',
  'Hi {{customer_name}},\n\n{{status_message}}\n\nOrder: {{order_number}}\nStatus: {{delivery_status}}\nScheduled: {{delivery_date}} · {{scheduled_window}}\n\n{{rating_link}}',
  '["customer_name","order_number","delivery_status","delivery_date","scheduled_window","status_message","rating_link"]'
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
  'customer_jurgens_delivery_update',
  false,
  true,
  false,
  'high',
  false,
  false
)
ON CONFLICT ("event_key") DO NOTHING;
