ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "requires_exchange_empty" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "exchange_empty_cylinder_size" varchar(80);
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "exchange_accepted_return_brands" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "exchange_confirmation_text" text;
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "purchase_type" varchar(32) NOT NULL DEFAULT 'standard';
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "exchange_empty_confirmed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "exchange_return_brand" varchar(120);
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "exchange_required_empty_cylinder_size" varchar(80);
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "exchange_accepted_return_brands_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "exchange_confirmation_text_snapshot" text;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "delivery_method_snapshot" varchar(32);
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "delivery_label_snapshot" text;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "purchase_type" varchar(32) NOT NULL DEFAULT 'standard';
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "exchange_empty_confirmed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "exchange_return_brand" varchar(120);
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "exchange_required_empty_cylinder_size" varchar(80);
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "exchange_accepted_return_brands_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "exchange_confirmation_text_snapshot" text;
