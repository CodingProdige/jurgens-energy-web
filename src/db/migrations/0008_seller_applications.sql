CREATE TYPE "public"."seller_application_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email" varchar(254) NOT NULL,
  "full_name" varchar(160),
  "store_name" varchar(160) NOT NULL,
  "business_type" varchar(120) NOT NULL,
  "country_region" varchar(120) NOT NULL,
  "phone" varchar(40) NOT NULL,
  "address_line_1" varchar(240) NOT NULL,
  "address_line_2" varchar(240),
  "city" varchar(120) NOT NULL,
  "state_province" varchar(120) NOT NULL,
  "postal_code" varchar(40) NOT NULL,
  "status" "seller_application_status" DEFAULT 'pending' NOT NULL,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "seller_applications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
