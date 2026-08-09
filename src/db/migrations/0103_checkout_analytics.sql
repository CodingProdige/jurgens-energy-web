DO $$
BEGIN
  CREATE TYPE "checkout_analytics_event_name" AS ENUM (
    'started',
    'address_completed',
    'shipping_completed',
    'payment_reached',
    'payment_attempted',
    'payfast_redirected',
    'order_created',
    'payment_confirmed',
    'checkout_failed',
    'payment_cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "checkout_analytics_session_status" AS ENUM (
    'active',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "checkout_analytics_device_category" AS ENUM (
    'desktop',
    'mobile',
    'tablet',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_analytics_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid,
  "order_id" uuid,
  "status" "checkout_analytics_session_status" DEFAULT 'active' NOT NULL,
  "latest_step" "checkout_analytics_event_name" NOT NULL,
  "campaign_attribution_snapshot" jsonb,
  "cart_value" numeric(12, 2),
  "currency" varchar(3),
  "item_count" integer,
  "total_quantity" integer,
  "landing_path" varchar(2048),
  "referrer_host" varchar(253),
  "device_category" "checkout_analytics_device_category" DEFAULT 'unknown' NOT NULL,
  "last_error_code" varchar(120),
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "failed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_analytics_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "checkout_analytics_sessions_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "checkout_analytics_sessions_cart_value_nonnegative_check"
    CHECK ("cart_value" IS NULL OR "cart_value" >= 0),
  CONSTRAINT "checkout_analytics_sessions_item_count_nonnegative_check"
    CHECK ("item_count" IS NULL OR "item_count" >= 0),
  CONSTRAINT "checkout_analytics_sessions_total_quantity_nonnegative_check"
    CHECK ("total_quantity" IS NULL OR "total_quantity" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_first_seen_at_idx"
  ON "checkout_analytics_sessions" ("first_seen_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_last_seen_at_idx"
  ON "checkout_analytics_sessions" ("last_seen_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_status_last_seen_at_idx"
  ON "checkout_analytics_sessions" ("status", "last_seen_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_order_id_idx"
  ON "checkout_analytics_sessions" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_sessions_completed_at_idx"
  ON "checkout_analytics_sessions" ("completed_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_analytics_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "session_id" uuid NOT NULL,
  "event_name" "checkout_analytics_event_name" NOT NULL,
  "user_id" uuid,
  "order_id" uuid,
  "cart_value" numeric(12, 2),
  "currency" varchar(3),
  "item_count" integer,
  "total_quantity" integer,
  "error_code" varchar(120),
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_analytics_events_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "checkout_analytics_sessions"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "checkout_analytics_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "checkout_analytics_events_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "checkout_analytics_events_cart_value_nonnegative_check"
    CHECK ("cart_value" IS NULL OR "cart_value" >= 0),
  CONSTRAINT "checkout_analytics_events_item_count_nonnegative_check"
    CHECK ("item_count" IS NULL OR "item_count" >= 0),
  CONSTRAINT "checkout_analytics_events_total_quantity_nonnegative_check"
    CHECK ("total_quantity" IS NULL OR "total_quantity" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_events_occurred_at_idx"
  ON "checkout_analytics_events" ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_events_event_name_occurred_at_idx"
  ON "checkout_analytics_events" ("event_name", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_events_session_id_occurred_at_idx"
  ON "checkout_analytics_events" ("session_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_analytics_events_order_id_occurred_at_idx"
  ON "checkout_analytics_events" ("order_id", "occurred_at");
