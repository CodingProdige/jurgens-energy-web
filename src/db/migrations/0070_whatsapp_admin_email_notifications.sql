ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_email_notifications_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_email_notify_new_conversation" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_email_notify_inbound_message" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_email_notification_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL;
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
  "required_variables",
  "version",
  "updated_at"
)
VALUES
(
  'admin.whatsapp.conversation.started',
  'Admin WhatsApp conversation started',
  'whatsapp',
  'Sent to configured administrators when a customer starts a new WhatsApp conversation.',
  'active',
  'New WhatsApp conversation with {{customerDisplayName}}',
  '{{customerDisplayName}} started a WhatsApp conversation.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">New WhatsApp conversation</h1><p><strong>Customer:</strong> {{customerDisplayName}}<br><strong>Phone:</strong> {{customerPhone}}<br><strong>Provider:</strong> {{providerLabel}}<br><strong>Received:</strong> {{receivedAtLabel}}</p><div style="margin-top:18px;padding:16px;background:#f7f7f2;border-left:4px solid #ff5a1f;white-space:pre-wrap">{{messageBody}}</div><p style="margin-top:18px"><a href="{{adminConversationUrl}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Open conversation</a></p></div>',
  'New WhatsApp conversation\n\nCustomer: {{customerDisplayName}}\nPhone: {{customerPhone}}\nProvider: {{providerLabel}}\nReceived: {{receivedAtLabel}}\n\n{{messageBody}}\n\nOpen conversation: {{adminConversationUrl}}',
  '["customerDisplayName","customerPhone","messageBody","receivedAtLabel","providerLabel","adminConversationUrl"]',
  1,
  now()
),
(
  'admin.whatsapp.message.received',
  'Admin WhatsApp message received',
  'whatsapp',
  'Sent to configured administrators when a customer sends an inbound WhatsApp message.',
  'active',
  'New WhatsApp message from {{customerDisplayName}}',
  '{{customerDisplayName}} sent a WhatsApp message.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">New WhatsApp message</h1><p><strong>Customer:</strong> {{customerDisplayName}}<br><strong>Phone:</strong> {{customerPhone}}<br><strong>Provider:</strong> {{providerLabel}}<br><strong>Received:</strong> {{receivedAtLabel}}</p><div style="margin-top:18px;padding:16px;background:#f7f7f2;border-left:4px solid #ff5a1f;white-space:pre-wrap">{{messageBody}}</div><p style="margin-top:18px"><a href="{{adminConversationUrl}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Open conversation</a></p></div>',
  'New WhatsApp message\n\nCustomer: {{customerDisplayName}}\nPhone: {{customerPhone}}\nProvider: {{providerLabel}}\nReceived: {{receivedAtLabel}}\n\n{{messageBody}}\n\nOpen conversation: {{adminConversationUrl}}',
  '["customerDisplayName","customerPhone","messageBody","receivedAtLabel","providerLabel","adminConversationUrl"]',
  1,
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
VALUES
(
  'admin.whatsapp.conversation.started',
  false,
  true,
  false,
  'high',
  false,
  false,
  now(),
  now()
),
(
  'admin.whatsapp.message.received',
  false,
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
  "in_app_enabled" = false,
  "email_enabled" = true,
  "push_enabled" = false,
  "priority" = 'high',
  "quiet_hours_enabled" = false,
  "digest_eligible" = false,
  "updated_at" = now();
