ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "feature_bullets" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "is_highlighted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_live_product_id" varchar(255);--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_sandbox_product_id" varchar(255);--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_sync_error" text;--> statement-breakpoint
INSERT INTO "subscription_plans" (
  "code",
  "name",
  "description",
  "scope",
  "status",
  "price_cents",
  "currency",
  "billing_interval",
  "storage_quota_mb",
  "feature_bullets",
  "is_default",
  "is_highlighted",
  "sort_order",
  "created_at",
  "updated_at"
) VALUES (
  'piessang-premium-monthly',
  'Piessang Premium',
  'Unlock more storage, faster uploads, and advanced media tools.',
  'user',
  'active',
  999,
  'USD',
  'month',
  5120,
  '5 GB of storage
Advanced media tools
Priority support
Faster uploads',
  true,
  true,
  10,
  now(),
  now()
) ON CONFLICT ("code") DO NOTHING;
