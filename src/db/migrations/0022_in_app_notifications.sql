CREATE TABLE IF NOT EXISTS "in_app_notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(160) NOT NULL,
  "name" varchar(180) NOT NULL,
  "category" varchar(80) DEFAULT 'system' NOT NULL,
  "description" text,
  "surface" varchar(32) DEFAULT 'marketplace' NOT NULL,
  "type" varchar(80) DEFAULT 'system' NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "title_template" varchar(180) NOT NULL,
  "body_template" text NOT NULL,
  "action_label_template" varchar(120),
  "action_url_template" text,
  "required_variables" text DEFAULT '[]' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "in_app_notification_templates_key_unique" UNIQUE("key")
);

CREATE INDEX IF NOT EXISTS "in_app_notification_templates_category_idx"
  ON "in_app_notification_templates" ("category");

CREATE INDEX IF NOT EXISTS "in_app_notification_templates_surface_idx"
  ON "in_app_notification_templates" ("surface");

CREATE TABLE IF NOT EXISTS "in_app_notification_template_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "in_app_notification_templates"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title_template" varchar(180) NOT NULL,
  "body_template" text NOT NULL,
  "action_label_template" varchar(120),
  "action_url_template" text,
  "required_variables" text DEFAULT '[]' NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "in_app_notification_template_versions_template_id_version_unique" UNIQUE("template_id","version")
);

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_key" varchar(160),
  "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "surface" varchar(32) NOT NULL,
  "type" varchar(80) DEFAULT 'system' NOT NULL,
  "title" varchar(180) NOT NULL,
  "body" text NOT NULL,
  "action_label" varchar(120),
  "action_url" text,
  "metadata" text,
  "read_at" timestamp,
  "dismissed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "in_app_notifications_recipient_user_id_idx"
  ON "in_app_notifications" ("recipient_user_id");

CREATE INDEX IF NOT EXISTS "in_app_notifications_surface_idx"
  ON "in_app_notifications" ("surface");

INSERT INTO "in_app_notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "surface",
  "type",
  "title_template",
  "body_template",
  "action_label_template",
  "action_url_template",
  "required_variables"
)
VALUES
  (
    'seller.application.submitted',
    'Seller application received',
    'seller_applications',
    'Shown to a seller applicant after submitting their application.',
    'seller',
    'seller_application',
    'Application received',
    'Thanks for applying to sell on Piessang. We received your application for {{storeName}} and our team will review it shortly.',
    'View application',
    '{{sellerDashboardUrl}}/register',
    '["storeName","sellerDashboardUrl"]'
  ),
  (
    'seller.application.approved',
    'Seller application approved',
    'seller_applications',
    'Shown when an admin approves a seller application.',
    'seller',
    'seller_application',
    'Your seller application was approved',
    '{{storeName}} is approved. You can now access your seller dashboard and start preparing your store.',
    'Open seller dashboard',
    '{{sellerDashboardUrl}}',
    '["storeName","sellerDashboardUrl"]'
  ),
  (
    'seller.application.rejected',
    'Seller application rejected',
    'seller_applications',
    'Shown when an admin rejects a seller application.',
    'seller',
    'seller_application',
    'Seller application update',
    'We reviewed your application for {{storeName}}, but we are unable to approve it right now. Reason: {{reason}}',
    'Review application',
    '{{sellerDashboardUrl}}/register',
    '["storeName","reason","sellerDashboardUrl"]'
  ),
  (
    'seller.application.needs_info',
    'Seller application needs information',
    'seller_applications',
    'Shown when an admin requests more information from a seller applicant.',
    'seller',
    'seller_application',
    'More information needed',
    'We need a little more information before we can finish reviewing {{storeName}}. {{message}}',
    'Update application',
    '{{sellerDashboardUrl}}/register',
    '["storeName","message","sellerDashboardUrl"]'
  ),
  (
    'admin.seller_application.submitted',
    'Admin seller application submitted',
    'seller_applications',
    'Shown to admins when a new seller application needs review.',
    'admin',
    'seller_application',
    'New seller application',
    '{{storeName}} submitted a seller application and is waiting for review.',
    'Review application',
    '{{adminDashboardUrl}}/sellers',
    '["storeName","adminDashboardUrl"]'
  )
ON CONFLICT ("key") DO NOTHING;
