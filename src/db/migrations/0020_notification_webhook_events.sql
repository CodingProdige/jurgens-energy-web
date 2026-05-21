CREATE TABLE IF NOT EXISTS "notification_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(80) DEFAULT 'sendgrid' NOT NULL,
  "provider_event_id" varchar(240) NOT NULL,
  "delivery_id" uuid REFERENCES "notification_deliveries"("id") ON DELETE set null,
  "event_type" varchar(80) NOT NULL,
  "payload" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_webhook_events_provider_event_unique" UNIQUE("provider","provider_event_id")
);

CREATE INDEX IF NOT EXISTS "notification_webhook_events_delivery_id_idx"
  ON "notification_webhook_events" ("delivery_id");
