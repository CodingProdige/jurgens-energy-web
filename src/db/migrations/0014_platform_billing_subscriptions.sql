DO $$ BEGIN
 CREATE TYPE "public"."subscription_scope" AS ENUM('user', 'seller');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_mode" AS ENUM('sandbox', 'live');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_mode" varchar(16) DEFAULT 'sandbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_live_publishable_key" text;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_live_secret_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_live_webhook_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_sandbox_publishable_key" text;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_sandbox_secret_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "marketplace_settings" ADD COLUMN IF NOT EXISTS "stripe_sandbox_webhook_secret_encrypted" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"scope" "subscription_scope" NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"billing_interval" varchar(32) DEFAULT 'month' NOT NULL,
	"storage_quota_mb" integer DEFAULT 5120 NOT NULL,
	"stripe_live_price_id" varchar(255),
	"stripe_sandbox_price_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid,
	"seller_id" uuid,
	"mode" "subscription_mode" DEFAULT 'sandbox' NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_code_unique" ON "subscription_plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_unique" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
