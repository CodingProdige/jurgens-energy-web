UPDATE "notification_templates"
SET
  "description" = replace(
    "description",
    'marketplace, seller, or admin access',
    'online-store, seller, or admin access'
  ),
  "subject" = replace(
    "subject",
    'Piessang {{surfaceLabel}}',
    'Jurgens Energy {{surfaceLabel}}'
  ),
  "html_body" = replace(
    "html_body",
    'Piessang {{surfaceLabel}}',
    'Jurgens Energy {{surfaceLabel}}'
  ),
  "text_body" = replace(
    "text_body",
    'Piessang {{surfaceLabel}}',
    'Jurgens Energy {{surfaceLabel}}'
  ),
  "updated_at" = now()
WHERE "key" = 'auth.password_reset.requested';
