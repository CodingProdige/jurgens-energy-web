CREATE TABLE IF NOT EXISTS "email_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "source" text DEFAULT 'coming_soon' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
INSERT INTO "email_subscribers" ("email", "source", "created_at", "updated_at")
SELECT "email", 'coming_soon', "created_at", now()
FROM "marketplace_waitlist_signups"
ON CONFLICT ("email") DO NOTHING;
