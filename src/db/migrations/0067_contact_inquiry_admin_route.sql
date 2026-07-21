UPDATE "in_app_notification_templates"
SET
  "action_label_template" = 'View inquiry',
  "action_url_template" = '/contact-inquiries/{{inquiryId}}',
  "updated_at" = now()
WHERE "key" = 'admin.contact_inquiry.received';
