ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_email_delivery_status_check",
  DROP CONSTRAINT IF EXISTS "credit_notes_whatsapp_delivery_status_check";
--> statement-breakpoint
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_email_delivery_status_check"
    CHECK ("email_delivery_status" IN ('pending', 'verification_required', 'sent', 'skipped', 'failed')),
  ADD CONSTRAINT "credit_notes_whatsapp_delivery_status_check"
    CHECK ("whatsapp_delivery_status" IN ('pending', 'verification_required', 'sent', 'skipped', 'failed'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_note_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "credit_note_id" uuid NOT NULL REFERENCES "credit_notes"("id") ON DELETE cascade,
  "channel" varchar(24) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "idempotency_key" varchar(180) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "claim_token" uuid,
  "locked_at" timestamp,
  "last_attempt_started_at" timestamp,
  "last_attempt_completed_at" timestamp,
  "provider_status" integer,
  "provider_message_id" varchar(240),
  "outcome_unknown" boolean DEFAULT false NOT NULL,
  "last_error" text,
  "sent_at" timestamp,
  "skipped_at" timestamp,
  "failed_at" timestamp,
  "verification_required_at" timestamp,
  "manual_reset_at" timestamp,
  "manual_reset_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "credit_note_delivery_attempts_credit_note_channel_unique" UNIQUE("credit_note_id", "channel"),
  CONSTRAINT "credit_note_delivery_attempts_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "credit_note_delivery_attempts_channel_check" CHECK ("channel" IN ('email', 'whatsapp')),
  CONSTRAINT "credit_note_delivery_attempts_status_check" CHECK ("status" IN ('pending', 'sending', 'verification_required', 'sent', 'skipped', 'failed')),
  CONSTRAINT "credit_note_delivery_attempts_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "credit_note_delivery_attempts_provider_status_check" CHECK ("provider_status" IS NULL OR "provider_status" BETWEEN 100 AND 599),
  CONSTRAINT "credit_note_delivery_attempts_claim_check" CHECK (
    ("status" = 'sending' AND "claim_token" IS NOT NULL AND "locked_at" IS NOT NULL)
    OR
    ("status" <> 'sending' AND "claim_token" IS NULL AND "locked_at" IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_note_delivery_attempts_status_available_idx"
  ON "credit_note_delivery_attempts" ("status", "available_at");
--> statement-breakpoint
INSERT INTO "credit_note_delivery_attempts" (
  "credit_note_id",
  "channel",
  "status",
  "idempotency_key",
  "attempts",
  "last_attempt_completed_at",
  "last_error",
  "outcome_unknown",
  "sent_at",
  "verification_required_at"
)
WITH delivery_state AS (
  SELECT
    note.*,
    channel."name" AS "channel",
    CASE channel."name"
      WHEN 'email' THEN note."email_delivery_status"
      ELSE note."whatsapp_delivery_status"
    END AS "legacy_status",
    CASE channel."name"
      WHEN 'email' THEN note."email_delivery_error"
      ELSE note."whatsapp_delivery_error"
    END AS "legacy_error",
    CASE channel."name"
      WHEN 'email' THEN note."email_sent_at"
      ELSE note."whatsapp_sent_at"
    END AS "legacy_sent_at",
    EXISTS (
      SELECT 1
      FROM "credit_note_jobs" AS job
      WHERE job."credit_note_id" = note."id"
        AND job."attempts" > 0
    ) AS "had_job_attempt"
  FROM "credit_notes" AS note
  CROSS JOIN (VALUES ('email'), ('whatsapp')) AS channel("name")
), normalized AS (
  SELECT
    delivery_state.*,
    (
      "legacy_status" = 'failed'
      OR (
        "legacy_status" = 'pending'
        AND "render_status" = 'ready'
        AND "had_job_attempt"
      )
    ) AS "requires_verification"
  FROM delivery_state
)
SELECT
  "id",
  "channel",
  CASE
    WHEN "requires_verification" THEN 'verification_required'
    ELSE "legacy_status"
  END,
  'credit-note:' || "id"::text || ':' || "channel" || ':v1',
  CASE
    WHEN "legacy_status" = 'pending' AND NOT "had_job_attempt" THEN 0
    ELSE 1
  END,
  "legacy_sent_at",
  CASE
    WHEN "requires_verification" THEN coalesce(
      nullif("legacy_error", ''),
      'Historical delivery outcome cannot be proven. Verify the provider before retrying.'
    )
    ELSE "legacy_error"
  END,
  "requires_verification",
  "legacy_sent_at",
  CASE WHEN "requires_verification" THEN now() ELSE NULL END
FROM normalized
ON CONFLICT ("credit_note_id", "channel") DO NOTHING;
--> statement-breakpoint
UPDATE "credit_notes" AS note
SET
  "email_delivery_status" = CASE
    WHEN email_attempt."status" = 'verification_required' THEN 'verification_required'
    ELSE note."email_delivery_status"
  END,
  "email_delivery_error" = CASE
    WHEN email_attempt."status" = 'verification_required' THEN email_attempt."last_error"
    ELSE note."email_delivery_error"
  END,
  "whatsapp_delivery_status" = CASE
    WHEN whatsapp_attempt."status" = 'verification_required' THEN 'verification_required'
    ELSE note."whatsapp_delivery_status"
  END,
  "whatsapp_delivery_error" = CASE
    WHEN whatsapp_attempt."status" = 'verification_required' THEN whatsapp_attempt."last_error"
    ELSE note."whatsapp_delivery_error"
  END,
  "updated_at" = now()
FROM "credit_note_delivery_attempts" AS email_attempt,
     "credit_note_delivery_attempts" AS whatsapp_attempt
WHERE email_attempt."credit_note_id" = note."id"
  AND email_attempt."channel" = 'email'
  AND whatsapp_attempt."credit_note_id" = note."id"
  AND whatsapp_attempt."channel" = 'whatsapp'
  AND (
    email_attempt."status" = 'verification_required'
    OR whatsapp_attempt."status" = 'verification_required'
  );
