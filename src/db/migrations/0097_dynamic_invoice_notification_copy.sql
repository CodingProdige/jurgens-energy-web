UPDATE "notification_templates"
SET
  "html_body" = replace(
    "html_body",
    'Your VAT invoice may still be preparing.',
    'Your invoice may still be preparing.'
  ),
  "text_body" = replace(
    "text_body",
    'Your VAT invoice may still be preparing.',
    'Your invoice may still be preparing.'
  ),
  "updated_at" = now()
WHERE "key" = 'customer.order.paid';
