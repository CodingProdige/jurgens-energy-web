CREATE TABLE "notification_global_variables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(80) NOT NULL,
  "label" varchar(160) NOT NULL,
  "value" text NOT NULL,
  "description" text,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_global_variables_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "notification_global_variables" ADD CONSTRAINT "notification_global_variables_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_global_variables" ADD CONSTRAINT "notification_global_variables_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "notification_global_variables_key_idx" ON "notification_global_variables" USING btree ("key");
