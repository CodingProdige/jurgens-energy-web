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
  'admin.order.created',
  'Admin order created alert',
  'orders',
  'Alerts order administrators when checkout creates an order awaiting PayFast confirmation.',
  'active',
  'New order {{order_number}} awaiting payment',
  '{{customer_name}} started checkout for {{order_total}}.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">New checkout order</h1><p><strong>Order:</strong> {{order_number}}<br><strong>Customer:</strong> {{customer_name}}<br><strong>Total:</strong> {{order_total}}</p><p>This order is awaiting PayFast confirmation. Do not fulfil it until the payment status changes to paid.</p><p><a href="{{adminDashboardUrl}}/orders/{{order_id}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Open order</a></p></div>',
  'New checkout order\n\nOrder: {{order_number}}\nCustomer: {{customer_name}}\nTotal: {{order_total}}\n\nThis order is awaiting PayFast confirmation. Do not fulfil it until the payment status changes to paid.\nOpen order: {{adminDashboardUrl}}/orders/{{order_id}}',
  '["customer_name","order_id","order_number","order_total","adminDashboardUrl"]',
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
  'admin.order.created',
  'Admin order created alert',
  'orders',
  'Shown to order administrators when checkout creates an order awaiting PayFast confirmation.',
  'admin',
  'order_created',
  'active',
  'Order awaiting payment {{order_number}}',
  '{{customer_name}} · {{order_total}}',
  'Open order',
  '/orders/{{order_id}}',
  '["customer_name","order_id","order_number","order_total"]',
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
  'admin.order.created',
  true,
  true,
  false,
  'normal',
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
