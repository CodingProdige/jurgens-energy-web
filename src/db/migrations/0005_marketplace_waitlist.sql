CREATE TABLE IF NOT EXISTS "marketplace_waitlist_signups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "marketplace_waitlist_signups_email_unique" UNIQUE("email")
);
