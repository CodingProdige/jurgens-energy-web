CREATE TABLE IF NOT EXISTS "notification_delivery_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_key" varchar(160) NOT NULL,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "email_enabled" boolean DEFAULT false NOT NULL,
  "push_enabled" boolean DEFAULT false NOT NULL,
  "priority" varchar(32) DEFAULT 'normal' NOT NULL,
  "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "digest_eligible" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_delivery_policies_event_key_unique" UNIQUE("event_key")
);

CREATE INDEX IF NOT EXISTS "notification_delivery_policies_event_key_idx"
  ON "notification_delivery_policies" ("event_key");

CREATE TABLE IF NOT EXISTS "push_notification_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "surface" varchar(32) DEFAULT 'marketplace' NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  CONSTRAINT "push_notification_subscriptions_endpoint_unique" UNIQUE("endpoint")
);

CREATE INDEX IF NOT EXISTS "push_notification_subscriptions_user_id_idx"
  ON "push_notification_subscriptions" ("user_id");

CREATE INDEX IF NOT EXISTS "push_notification_subscriptions_surface_idx"
  ON "push_notification_subscriptions" ("surface");

INSERT INTO "notification_delivery_policies" (
  "event_key",
  "in_app_enabled",
  "email_enabled",
  "push_enabled",
  "priority",
  "quiet_hours_enabled",
  "digest_eligible",
  "created_at",
  "updated_at"
)
SELECT
  template_keys."key",
  template_keys."has_in_app",
  template_keys."has_email",
  false,
  CASE
    WHEN template_keys."key" LIKE '%application%' THEN 'high'
    ELSE 'normal'
  END,
  false,
  false,
  now(),
  now()
FROM (
  SELECT
    COALESCE(email_templates."key", in_app_templates."key") AS "key",
    email_templates."key" IS NOT NULL AS "has_email",
    in_app_templates."key" IS NOT NULL AS "has_in_app"
  FROM "notification_templates" email_templates
  FULL OUTER JOIN "in_app_notification_templates" in_app_templates
    ON in_app_templates."key" = email_templates."key"
) template_keys
WHERE template_keys."key" IS NOT NULL
ON CONFLICT ("event_key") DO NOTHING;
