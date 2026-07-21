CREATE TABLE IF NOT EXISTS "contact_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "email" varchar(254) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(32) DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_inquiries_status_created_at_idx"
  ON "contact_inquiries" ("status", "created_at");
--> statement-breakpoint
INSERT INTO "notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "subject",
  "preview_text",
  "html_body",
  "text_body",
  "required_variables",
  "updated_at"
)
VALUES (
  'admin.contact_inquiry.received',
  'Admin contact inquiry received',
  'customer_support',
  'Sent to administrators when a visitor submits the public contact form.',
  'New website inquiry from {{contactName}}',
  '{{contactName}} sent a message through JurgensEnergy.com.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">New contact inquiry</h1><p><strong>From:</strong> {{contactName}} &lt;{{contactEmail}}&gt;</p><p><strong>Received:</strong> {{receivedAtLabel}}</p><p><strong>Reference:</strong> {{inquiryId}}</p><div style="margin-top:18px;padding:16px;background:#f7f7f2;border-left:4px solid #ff5a1f;white-space:pre-wrap">{{contactMessage}}</div><p style="margin-top:18px"><a href="mailto:{{contactEmail}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Reply by email</a></p></div>',
  'New contact inquiry\n\nFrom: {{contactName}} <{{contactEmail}}>\nReceived: {{receivedAtLabel}}\nReference: {{inquiryId}}\n\n{{contactMessage}}',
  '["contactName","contactEmail","contactMessage","inquiryId","receivedAtLabel"]',
  now()
)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
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
  "required_variables",
  "updated_at"
)
VALUES (
  'admin.contact_inquiry.received',
  'Admin contact inquiry received',
  'customer_support',
  'Shown to administrators when a visitor submits the public contact form.',
  'admin',
  'contact_inquiry',
  'New contact inquiry',
  '{{contactName}} ({{contactEmail}}): {{messagePreview}}',
  NULL,
  NULL,
  '["contactName","contactEmail","messagePreview","inquiryId"]',
  now()
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
  "digest_eligible",
  "created_at",
  "updated_at"
)
VALUES (
  'admin.contact_inquiry.received',
  true,
  true,
  false,
  'high',
  false,
  false,
  now(),
  now()
)
ON CONFLICT ("event_key") DO UPDATE
SET
  "in_app_enabled" = true,
  "email_enabled" = true,
  "push_enabled" = false,
  "priority" = 'high',
  "digest_eligible" = false,
  "updated_at" = now();
