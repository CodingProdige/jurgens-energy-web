ALTER TABLE "business_information"
  ADD COLUMN IF NOT EXISTS "public_registration_details_enabled" boolean DEFAULT true NOT NULL;
