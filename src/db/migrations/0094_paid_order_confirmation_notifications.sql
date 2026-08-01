ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_order_notifications_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp_order_notification_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL;
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
  "updated_at"
)
VALUES (
  'customer.order.paid',
  'Customer paid order confirmation',
  'orders',
  'Sent to the customer immediately after PayFast confirms payment.',
  'active',
  'Order {{order_number}} confirmed',
  'Payment received for {{order_total}}.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">Payment confirmed</h1><p>Hi {{customer_name}},</p><p>We received payment for order <strong>{{order_number}}</strong>.</p><p><strong>Total:</strong> {{order_total}}<br><strong>Delivery:</strong> {{delivery_window}}</p><p>Your VAT invoice may still be preparing. You do not need to wait on the confirmation page — we will send the invoice as soon as it is ready, and it will be available in your account.</p><p><a href="{{order_url}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">View order</a></p></div>',
  'Hi {{customer_name}},\n\nWe received payment for order {{order_number}}.\nTotal: {{order_total}}\nDelivery: {{delivery_window}}\n\nYour VAT invoice may still be preparing. You do not need to wait on the confirmation page — we will send the invoice as soon as it is ready, and it will be available in your account.\n\nView order: {{order_url}}',
  '["customer_name","delivery_window","order_id","order_number","order_total","order_url"]',
  now()
)
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "subject" = EXCLUDED."subject",
  "preview_text" = EXCLUDED."preview_text",
  "html_body" = EXCLUDED."html_body",
  "text_body" = EXCLUDED."text_body",
  "required_variables" = EXCLUDED."required_variables",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "in_app_notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "surface",
  "type",
  "status",
  "title_template",
  "body_template",
  "action_label_template",
  "action_url_template",
  "required_variables",
  "updated_at"
)
VALUES (
  'customer.order.paid',
  'Customer paid order confirmation',
  'orders',
  'Shown to customers after PayFast confirms payment.',
  'marketplace',
  'paid_order',
  'active',
  'Payment confirmed for {{order_number}}',
  '{{order_total}} · {{delivery_window}}',
  'View order',
  '/account/orders/{{order_id}}',
  '["delivery_window","order_id","order_number","order_total"]',
  now()
)
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "surface" = EXCLUDED."surface",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "title_template" = EXCLUDED."title_template",
  "body_template" = EXCLUDED."body_template",
  "action_label_template" = EXCLUDED."action_label_template",
  "action_url_template" = EXCLUDED."action_url_template",
  "required_variables" = EXCLUDED."required_variables",
  "updated_at" = now();
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
  'customer.order.paid',
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
  "in_app_enabled" = EXCLUDED."in_app_enabled",
  "email_enabled" = EXCLUDED."email_enabled",
  "push_enabled" = EXCLUDED."push_enabled",
  "priority" = EXCLUDED."priority",
  "digest_eligible" = EXCLUDED."digest_eligible",
  "updated_at" = now();
