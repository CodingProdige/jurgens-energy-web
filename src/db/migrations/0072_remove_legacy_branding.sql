DO $$
DECLARE
  legacy_brand text := 'Pies' || 'sang';
  legacy_token text := 'pies' || 'sang';
BEGIN
  UPDATE "subscription_plans"
  SET
    "code" = replace("code", legacy_token, 'jurgens-energy'),
    "name" = replace("name", legacy_brand, 'Jurgens Energy'),
    "description" = replace("description", legacy_brand, 'Jurgens Energy'),
    "feature_bullets" = replace("feature_bullets", legacy_brand, 'Jurgens Energy'),
    "updated_at" = now()
  WHERE
    "code" LIKE '%' || legacy_token || '%'
    OR "name" LIKE '%' || legacy_brand || '%'
    OR "description" LIKE '%' || legacy_brand || '%'
    OR "feature_bullets" LIKE '%' || legacy_brand || '%';

  UPDATE "notification_templates"
  SET
    "name" = replace("name", legacy_brand, 'Jurgens Energy'),
    "description" = replace("description", legacy_brand, 'Jurgens Energy'),
    "subject" = replace("subject", legacy_brand, 'Jurgens Energy'),
    "preview_text" = replace("preview_text", legacy_brand, 'Jurgens Energy'),
    "html_body" = replace("html_body", legacy_brand, 'Jurgens Energy'),
    "text_body" = replace("text_body", legacy_brand, 'Jurgens Energy'),
    "updated_at" = now()
  WHERE
    "name" LIKE '%' || legacy_brand || '%'
    OR "description" LIKE '%' || legacy_brand || '%'
    OR "subject" LIKE '%' || legacy_brand || '%'
    OR "preview_text" LIKE '%' || legacy_brand || '%'
    OR "html_body" LIKE '%' || legacy_brand || '%'
    OR "text_body" LIKE '%' || legacy_brand || '%';

  UPDATE "notification_template_versions"
  SET
    "subject" = replace("subject", legacy_brand, 'Jurgens Energy'),
    "preview_text" = replace("preview_text", legacy_brand, 'Jurgens Energy'),
    "html_body" = replace("html_body", legacy_brand, 'Jurgens Energy'),
    "text_body" = replace("text_body", legacy_brand, 'Jurgens Energy')
  WHERE
    "subject" LIKE '%' || legacy_brand || '%'
    OR "preview_text" LIKE '%' || legacy_brand || '%'
    OR "html_body" LIKE '%' || legacy_brand || '%'
    OR "text_body" LIKE '%' || legacy_brand || '%';

  UPDATE "in_app_notification_templates"
  SET
    "name" = replace("name", legacy_brand, 'Jurgens Energy'),
    "description" = replace("description", legacy_brand, 'Jurgens Energy'),
    "title_template" = replace("title_template", legacy_brand, 'Jurgens Energy'),
    "body_template" = replace("body_template", legacy_brand, 'Jurgens Energy'),
    "action_label_template" = replace(
      "action_label_template",
      legacy_brand,
      'Jurgens Energy'
    ),
    "action_url_template" = replace(
      "action_url_template",
      legacy_token,
      'jurgens-energy'
    ),
    "updated_at" = now()
  WHERE
    "name" LIKE '%' || legacy_brand || '%'
    OR "description" LIKE '%' || legacy_brand || '%'
    OR "title_template" LIKE '%' || legacy_brand || '%'
    OR "body_template" LIKE '%' || legacy_brand || '%'
    OR "action_label_template" LIKE '%' || legacy_brand || '%'
    OR "action_url_template" LIKE '%' || legacy_token || '%';

  UPDATE "in_app_notification_template_versions"
  SET
    "title_template" = replace(
      "title_template",
      legacy_brand,
      'Jurgens Energy'
    ),
    "body_template" = replace(
      "body_template",
      legacy_brand,
      'Jurgens Energy'
    ),
    "action_label_template" = replace(
      "action_label_template",
      legacy_brand,
      'Jurgens Energy'
    ),
    "action_url_template" = replace(
      "action_url_template",
      legacy_token,
      'jurgens-energy'
    )
  WHERE
    "title_template" LIKE '%' || legacy_brand || '%'
    OR "body_template" LIKE '%' || legacy_brand || '%'
    OR "action_label_template" LIKE '%' || legacy_brand || '%'
    OR "action_url_template" LIKE '%' || legacy_token || '%';

  UPDATE "notification_deliveries"
  SET
    "subject" = replace("subject", legacy_brand, 'Jurgens Energy'),
    "metadata" = replace(
      replace("metadata", legacy_brand, 'Jurgens Energy'),
      legacy_token,
      'jurgens-energy'
    )
  WHERE
    "subject" LIKE '%' || legacy_brand || '%'
    OR "metadata" LIKE '%' || legacy_brand || '%'
    OR "metadata" LIKE '%' || legacy_token || '%';

  UPDATE "notification_webhook_events"
  SET "payload" = replace(
    replace("payload", legacy_brand, 'Jurgens Energy'),
    legacy_token,
    'notification'
  )
  WHERE
    "payload" LIKE '%' || legacy_brand || '%'
    OR "payload" LIKE '%' || legacy_token || '%';

  UPDATE "notification_global_variables"
  SET
    "label" = replace("label", legacy_brand, 'Jurgens Energy'),
    "value" = replace(
      replace("value", legacy_brand, 'Jurgens Energy'),
      legacy_token,
      'jurgens-energy'
    ),
    "description" = replace(
      "description",
      legacy_brand,
      'Jurgens Energy'
    ),
    "updated_at" = now()
  WHERE
    "label" LIKE '%' || legacy_brand || '%'
    OR "value" LIKE '%' || legacy_brand || '%'
    OR "value" LIKE '%' || legacy_token || '%'
    OR "description" LIKE '%' || legacy_brand || '%';
END $$;
