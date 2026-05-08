CREATE TABLE "user_roles" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_id_pk" PRIMARY KEY("id"),
	CONSTRAINT "user_roles_user_id_role_unique" UNIQUE("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role")
SELECT "id", 'customer' FROM "users"
ON CONFLICT ("user_id", "role") DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role")
SELECT "id", 'admin' FROM "users"
WHERE "role" = 'admin' OR "is_admin" = true
ON CONFLICT ("user_id", "role") DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role")
SELECT "id", 'seller_staff' FROM "users"
WHERE ("role" = 'seller' OR "has_seller_access" = true)
AND NOT ("role" = 'admin' OR "is_admin" = true)
ON CONFLICT ("user_id", "role") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_admin";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "has_seller_access";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."user_role";
--> statement-breakpoint
ALTER TABLE "seller_staff" ALTER COLUMN "role" SET DEFAULT 'staff';
--> statement-breakpoint
ALTER TABLE "seller_staff" ADD CONSTRAINT "seller_staff_seller_id_user_id_unique" UNIQUE("seller_id","user_id");
