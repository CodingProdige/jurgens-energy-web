ALTER TABLE "seller_applications" ADD COLUMN IF NOT EXISTS "store_slug" varchar(160);
--> statement-breakpoint
UPDATE "seller_applications"
SET "store_slug" = lower(regexp_replace(regexp_replace(trim("store_name"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE "store_slug" IS NULL;
--> statement-breakpoint
UPDATE "seller_applications"
SET "store_slug" = "id"::text
WHERE "store_slug" IS NULL OR "store_slug" = '';
--> statement-breakpoint
ALTER TABLE "seller_applications" ALTER COLUMN "store_slug" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_store_slug_unique" UNIQUE("store_slug");
