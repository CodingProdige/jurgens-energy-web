CREATE TABLE IF NOT EXISTS "marketplace_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"coming_soon_enabled" boolean DEFAULT false NOT NULL,
	"coming_soon_password_hash" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "marketplace_settings" ("id", "coming_soon_enabled")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
