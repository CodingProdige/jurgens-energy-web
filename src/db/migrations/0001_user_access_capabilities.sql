ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_seller_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_admin" = true WHERE "role" = 'admin';--> statement-breakpoint
UPDATE "users" SET "has_seller_access" = true WHERE "role" IN ('seller', 'admin');--> statement-breakpoint
UPDATE "users" SET "role" = 'customer' WHERE "role" <> 'customer';
