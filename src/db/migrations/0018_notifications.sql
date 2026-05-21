CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(160) NOT NULL,
  "name" varchar(180) NOT NULL,
  "category" varchar(80) DEFAULT 'system' NOT NULL,
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "subject" varchar(240) NOT NULL,
  "preview_text" varchar(240),
  "html_body" text NOT NULL,
  "text_body" text NOT NULL,
  "required_variables" text DEFAULT '[]' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_templates_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "notification_template_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "notification_templates"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "subject" varchar(240) NOT NULL,
  "preview_text" varchar(240),
  "html_body" text NOT NULL,
  "text_body" text NOT NULL,
  "required_variables" text DEFAULT '[]' NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_template_versions_template_id_version_unique" UNIQUE("template_id","version")
);

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_key" varchar(160) NOT NULL,
  "recipient_email" varchar(254) NOT NULL,
  "recipient_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "subject" varchar(240) NOT NULL,
  "status" varchar(32) DEFAULT 'queued' NOT NULL,
  "provider" varchar(80) DEFAULT 'sendgrid' NOT NULL,
  "provider_message_id" varchar(240),
  "error_message" text,
  "metadata" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_deliveries_template_key_idx"
  ON "notification_deliveries" ("template_key");

CREATE INDEX IF NOT EXISTS "notification_deliveries_recipient_email_idx"
  ON "notification_deliveries" ("recipient_email");

INSERT INTO "notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "subject",
  "preview_text",
  "html_body",
  "text_body",
  "required_variables"
)
VALUES
  (
    'seller.application.submitted',
    'Seller application received',
    'seller_applications',
    'Sent to a seller applicant after submitting their application.',
    'We received your Piessang seller application',
    'Your application is pending review.',
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">Application received</h1><p>Hi {{name}},</p><p>Thanks for applying to sell on Piessang. We received your application for <strong>{{storeName}}</strong> and our team will review it shortly.</p><p style="color:#596176;font-size:14px">We will email you again when the review is complete.</p></div>',
    'Hi {{name}},\n\nThanks for applying to sell on Piessang. We received your application for {{storeName}} and our team will review it shortly.\n\nWe will email you again when the review is complete.',
    '["name","storeName"]'
  ),
  (
    'seller.application.approved',
    'Seller application approved',
    'seller_applications',
    'Sent when an admin approves a seller application.',
    'Your Piessang seller application was approved',
    'You can now access your seller dashboard.',
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">Welcome to Piessang Seller</h1><p>Hi {{name}},</p><p>Your seller application for <strong>{{storeName}}</strong> has been approved.</p><p><a href="{{sellerDashboardUrl}}" style="display:inline-block;background:#065f24;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open seller dashboard</a></p></div>',
    'Hi {{name}},\n\nYour seller application for {{storeName}} has been approved.\n\nOpen your seller dashboard: {{sellerDashboardUrl}}',
    '["name","storeName","sellerDashboardUrl"]'
  ),
  (
    'seller.application.rejected',
    'Seller application rejected',
    'seller_applications',
    'Sent when an admin rejects a seller application.',
    'Update on your Piessang seller application',
    'Your seller application review is complete.',
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">Seller application update</h1><p>Hi {{name}},</p><p>We reviewed your application for <strong>{{storeName}}</strong>, but we are unable to approve it right now.</p><p><strong>Reason:</strong> {{reason}}</p><p style="color:#596176;font-size:14px">You can contact support if you believe this needs another look.</p></div>',
    'Hi {{name}},\n\nWe reviewed your application for {{storeName}}, but we are unable to approve it right now.\n\nReason: {{reason}}\n\nYou can contact support if you believe this needs another look.',
    '["name","storeName","reason"]'
  ),
  (
    'seller.application.needs_info',
    'Seller application needs information',
    'seller_applications',
    'Sent when an admin needs more information from a seller applicant.',
    'We need more information for your Piessang seller application',
    'Please update your seller application details.',
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">More information needed</h1><p>Hi {{name}},</p><p>We need a little more information before we can finish reviewing <strong>{{storeName}}</strong>.</p><p>{{message}}</p></div>',
    'Hi {{name}},\n\nWe need a little more information before we can finish reviewing {{storeName}}.\n\n{{message}}',
    '["name","storeName","message"]'
  )
ON CONFLICT ("key") DO NOTHING;
