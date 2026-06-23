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
VALUES
  (
    'admin.product_review.submitted',
    'Admin product review submitted',
    'products',
    'Shown to admins when a seller submits a product for review.',
    'admin',
    'product_review',
    'Product submitted for review',
    '{{sellerName}} submitted {{productTitle}} for review.',
    'Review product',
    '{{adminProductReviewUrl}}',
    '["sellerName","productTitle","productId","adminProductReviewUrl"]',
    now()
  ),
  (
    'seller.product_review.approved',
    'Seller product approved',
    'products',
    'Shown to sellers when an admin approves one of their submitted products.',
    'seller',
    'product_review',
    'Product approved',
    '{{productTitle}} has been approved.',
    'Open product',
    '{{productEditUrl}}',
    '["productTitle","productId","productEditUrl"]',
    now()
  ),
  (
    'seller.product_review.changes_requested',
    'Seller product changes requested',
    'products',
    'Shown to sellers when an admin requests changes on a submitted product.',
    'seller',
    'product_review',
    'Product changes requested',
    '{{productTitle}} needs updates before it can be approved. {{reason}}',
    'Update product',
    '{{productEditUrl}}',
    '["productTitle","productId","reason","productEditUrl"]',
    now()
  )
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "surface" = EXCLUDED."surface",
  "type" = EXCLUDED."type",
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
VALUES
  (
    'admin.product_review.submitted',
    true,
    false,
    false,
    'high',
    false,
    false,
    now(),
    now()
  ),
  (
    'seller.product_review.approved',
    true,
    false,
    false,
    'normal',
    false,
    false,
    now(),
    now()
  ),
  (
    'seller.product_review.changes_requested',
    true,
    false,
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
  "priority" = EXCLUDED."priority",
  "updated_at" = now();
