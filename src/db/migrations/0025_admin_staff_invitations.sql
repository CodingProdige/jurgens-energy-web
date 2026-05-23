CREATE TABLE IF NOT EXISTS "admin_staff" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" varchar(64) NOT NULL,
  "invited_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_staff_user_id_unique" UNIQUE("user_id")
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "admin_staff_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "role" varchar(64) NOT NULL,
  "token_hash" text NOT NULL,
  "invited_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "accepted_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "accepted_at" timestamp,
  "revoked_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_staff_invitations_token_hash_unique" UNIQUE("token_hash")
);

--> statement-breakpoint

INSERT INTO "admin_staff" ("user_id", "role", "created_at", "updated_at")
SELECT DISTINCT "user_id", 'owner', now(), now()
FROM "user_roles"
WHERE "role" IN ('admin', 'superadmin')
ON CONFLICT ("user_id") DO NOTHING;

--> statement-breakpoint

INSERT INTO "notification_templates" (
  "key",
  "name",
  "category",
  "description",
  "subject",
  "preview_text",
  "html_body",
  "text_body",
  "required_variables"
)
VALUES (
  'admin.staff.invited',
  'Admin staff invited',
  'admin_staff',
  'Sent when a staff member is invited to access the admin dashboard.',
  'You have been invited to Piessang Admin',
  'Set your password to access the Piessang admin dashboard.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">Admin dashboard invitation</h1><p>Hi {{name}},</p><p>You have been invited to Piessang Admin with the <strong>{{roleLabel}}</strong> role.</p><p><a href="{{acceptUrl}}" style="display:inline-block;background:#070b16;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Accept invitation</a></p><p style="color:#596176;font-size:14px">This invitation expires at {{expiresAtLabel}}.</p></div>',
  'Hi {{name}},\n\nYou have been invited to Piessang Admin with the {{roleLabel}} role.\n\nAccept invitation: {{acceptUrl}}\n\nThis invitation expires at {{expiresAtLabel}}.',
  '["name","roleLabel","acceptUrl","expiresAtLabel"]'
)
ON CONFLICT ("key") DO NOTHING;

--> statement-breakpoint

INSERT INTO "notification_delivery_policies" (
  "event_key",
  "in_app_enabled",
  "email_enabled",
  "push_enabled",
  "priority",
  "quiet_hours_enabled",
  "digest_eligible",
  "created_at",
  "updated_at"
)
VALUES (
  'admin.staff.invited',
  false,
  true,
  false,
  'high',
  false,
  false,
  now(),
  now()
)
ON CONFLICT ("event_key") DO UPDATE
SET
  "email_enabled" = true,
  "in_app_enabled" = false,
  "push_enabled" = false,
  "priority" = 'high',
  "digest_eligible" = false,
  "updated_at" = now();
