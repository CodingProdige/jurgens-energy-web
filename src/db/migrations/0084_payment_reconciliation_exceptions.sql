CREATE TABLE IF NOT EXISTS "payment_reconciliation_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "latest_itn_event_id" uuid,
  "reason" varchar(80) NOT NULL,
  "status" varchar(24) DEFAULT 'open' NOT NULL,
  "provider_payment_id" varchar(160),
  "provider_status" varchar(80) NOT NULL,
  "received_amount" numeric(12, 2) NOT NULL,
  "detail" text NOT NULL,
  "occurrences" integer DEFAULT 1 NOT NULL,
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolution_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payment_reconciliation_exceptions_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "payment_reconciliation_exceptions_payment_id_payments_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "payment_reconciliation_exceptions_latest_itn_event_id_payfast_itn_events_id_fk"
    FOREIGN KEY ("latest_itn_event_id") REFERENCES "public"."payfast_itn_events"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "payment_reconciliation_exceptions_payment_id_unique"
    UNIQUE ("payment_id"),
  CONSTRAINT "payment_reconciliation_exceptions_occurrences_positive_check"
    CHECK ("occurrences" > 0),
  CONSTRAINT "payment_reconciliation_exceptions_reason_check"
    CHECK ("reason" IN (
      'inventory_unavailable_after_expiry',
      'inventory_reservation_invalid'
    )),
  CONSTRAINT "payment_reconciliation_exceptions_status_check"
    CHECK ("status" IN ('open', 'resolved'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_exceptions_order_id_idx"
  ON "payment_reconciliation_exceptions" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliation_exceptions_status_last_seen_idx"
  ON "payment_reconciliation_exceptions" ("status", "last_seen_at");
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
  'admin.payment.reconciliation_required',
  'Admin payment reconciliation alert',
  'orders',
  'Alerts administrators when PayFast confirms money received but inventory cannot safely be assigned to the order.',
  'active',
  'Urgent payment review: {{order_number}}',
  'PayFast confirmed {{payment_amount}}, but order {{order_number}} was not captured or released for fulfilment.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#080808"><h1 style="font-size:22px;margin:0 0 12px">Payment reconciliation required</h1><p>PayFast confirmed <strong>{{payment_amount}}</strong> for order <strong>{{order_number}}</strong>, but the order was not captured because inventory could not be assigned safely.</p><p><strong>Customer:</strong> {{customer_name}}<br><strong>Reason:</strong> {{exception_reason}}<br><strong>PayFast reference:</strong> {{provider_payment_id}}</p><p>Do not fulfil this order until the payment and inventory have been reviewed. Refund the PayFast payment if the order cannot be honoured.</p><p><a href="{{adminDashboardUrl}}/orders/{{order_id}}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:6px;font-weight:700">Review order</a></p></div>',
  'Payment reconciliation required\n\nPayFast confirmed {{payment_amount}} for order {{order_number}}, but the order was not captured because inventory could not be assigned safely.\nCustomer: {{customer_name}}\nReason: {{exception_reason}}\nPayFast reference: {{provider_payment_id}}\n\nDo not fulfil this order until reviewed. Refund the PayFast payment if the order cannot be honoured.\nReview: {{adminDashboardUrl}}/orders/{{order_id}}',
  '["adminDashboardUrl","customer_name","exception_reason","order_id","order_number","payment_amount","provider_payment_id"]',
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
VALUES (
  'admin.payment.reconciliation_required',
  'Admin payment reconciliation alert',
  'orders',
  'Shown when PayFast confirms a payment that cannot be safely captured against inventory.',
  'admin',
  'payment_exception',
  'active',
  'Payment review: {{order_number}}',
  '{{payment_amount}} confirmed · inventory unavailable',
  'Review order',
  '/orders/{{order_id}}',
  '["order_id","order_number","payment_amount"]',
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
  'admin.payment.reconciliation_required',
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
  "quiet_hours_enabled" = EXCLUDED."quiet_hours_enabled",
  "digest_eligible" = EXCLUDED."digest_eligible",
  "updated_at" = now();
