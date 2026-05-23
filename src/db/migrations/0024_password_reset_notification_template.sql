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
  'auth.password_reset.requested',
  'Password reset requested',
  'auth',
  'Sent when a user requests or is sent a password reset link for marketplace, seller, or admin access.',
  'Reset your Piessang {{surfaceLabel}} password',
  'Use this short-lived link to set a new password.',
  '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16"><h1 style="font-size:22px;margin:0 0 12px">Reset your Piessang {{surfaceLabel}} password</h1><p>Use the button below to set a new password.</p><p><a href="{{resetUrl}}" style="display:inline-block;background:#070b16;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Reset password</a></p><p style="color:#596176;font-size:14px">This link expires at {{expiresAtLabel}}.</p><p style="color:#596176;font-size:14px">If you did not request this reset, you can ignore this email.</p></div>',
  'Reset your Piessang {{surfaceLabel}} password\n\nUse the link below to set a new password:\n{{resetUrl}}\n\nThis link expires at {{expiresAtLabel}}.\nIf you did not request this reset, you can ignore this email.',
  '["surfaceLabel","resetUrl","expiresAtLabel"]'
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
  'auth.password_reset.requested',
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
