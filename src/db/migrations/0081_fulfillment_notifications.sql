CREATE TABLE IF NOT EXISTS "notification_dispatch_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dedupe_key" varchar(320) NOT NULL,
  "event_key" varchar(160) NOT NULL,
  "status" varchar(32) DEFAULT 'processing' NOT NULL,
  "attempts" integer DEFAULT 1 NOT NULL,
  "last_error" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "claimed_at" timestamp DEFAULT now() NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_dispatch_claims_dedupe_key_unique" UNIQUE("dedupe_key"),
  CONSTRAINT "notification_dispatch_claims_status_valid"
    CHECK ("status" IN ('processing', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_dispatch_claims_event_key_idx"
  ON "notification_dispatch_claims" ("event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_dispatch_claims_status_idx"
  ON "notification_dispatch_claims" ("status", "available_at");
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
VALUES
(
  'customer.courier_shipment.updated',
  'Customer Courier Guy shipment update',
  'orders',
  'Sent to a customer at important Courier Guy shipment milestones.',
  'active',
  'Courier update for {{order_number}}: {{shipment_status}}',
  'Your Courier Guy shipment is now {{shipment_status}}.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">Courier update</h1><p>Hi {{customer_name}},</p><p>Your Courier Guy shipment for order <strong>{{order_number}}</strong> is now <strong>{{shipment_status}}</strong>.</p><p><strong>Tracking number:</strong> {{tracking_number}}</p><p><a href="{{tracking_url}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Track shipment</a></p></div>',
  'Hi {{customer_name}},\n\nYour Courier Guy shipment for order {{order_number}} is now {{shipment_status}}.\nTracking number: {{tracking_number}}\nTrack shipment: {{tracking_url}}',
  '["customer_name","order_number","shipment_status","tracking_number","tracking_url"]',
  now()
),
(
  'admin.order.paid',
  'Admin paid order alert',
  'orders',
  'Alerts fulfilment administrators when PayFast confirms a paid order.',
  'active',
  'New paid order {{order_number}}',
  '{{customer_name}} placed a paid order for {{order_total}}.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">New paid order</h1><p><strong>Order:</strong> {{order_number}}<br><strong>Customer:</strong> {{customer_name}}<br><strong>Total:</strong> {{order_total}}</p><p><a href="{{adminDashboardUrl}}/orders/{{order_id}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Open order</a></p></div>',
  'New paid order\n\nOrder: {{order_number}}\nCustomer: {{customer_name}}\nTotal: {{order_total}}\nOpen order: {{adminDashboardUrl}}/orders/{{order_id}}',
  '["customer_name","order_id","order_number","order_total","adminDashboardUrl"]',
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
  "status",
  "title_template",
  "body_template",
  "action_label_template",
  "action_url_template",
  "required_variables",
  "updated_at"
)
VALUES
(
  'customer.courier_shipment.updated',
  'Customer Courier Guy shipment update',
  'orders',
  'Shown to customers at important Courier Guy shipment milestones.',
  'marketplace',
  'shipment_update',
  'active',
  'Courier update: {{shipment_status}}',
  'Order {{order_number}} · Tracking {{tracking_number}}',
  'Track shipment',
  '{{tracking_url}}',
  '["order_number","shipment_status","tracking_number","tracking_url"]',
  now()
),
(
  'admin.order.paid',
  'Admin paid order alert',
  'orders',
  'Shown to fulfilment administrators when PayFast confirms a paid order.',
  'admin',
  'paid_order',
  'active',
  'New paid order {{order_number}}',
  '{{customer_name}} · {{order_total}}',
  'Open order',
  '/orders/{{order_id}}',
  '["customer_name","order_id","order_number","order_total"]',
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
  'customer.courier_shipment.updated',
  true,
  true,
  false,
  'normal',
  false,
  false,
  now(),
  now()
),
(
  'admin.order.paid',
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
