ALTER TABLE "whatsapp_customer_links"
ADD COLUMN IF NOT EXISTS "verification_status" varchar(32) NOT NULL DEFAULT 'unverified';

ALTER TABLE "whatsapp_customer_links"
ADD COLUMN IF NOT EXISTS "verified_at" timestamp;

ALTER TABLE "whatsapp_customer_links"
ADD COLUMN IF NOT EXISTS "link_source" varchar(40) NOT NULL DEFAULT 'whatsapp';

UPDATE "whatsapp_customer_links"
SET
  "verification_status" = 'verified',
  "verified_at" = COALESCE("linked_at", "last_seen_at", "created_at"),
  "link_source" = 'whatsapp_origin'
WHERE
  "user_id" IS NOT NULL
  AND "linked_at" IS NOT NULL
  AND "verification_status" = 'unverified';
