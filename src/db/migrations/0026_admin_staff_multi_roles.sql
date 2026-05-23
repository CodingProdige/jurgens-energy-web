ALTER TABLE "admin_staff"
  ADD COLUMN IF NOT EXISTS "roles" text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE "admin_staff"
SET "roles" = ARRAY["role"]::text[]
WHERE cardinality("roles") = 0;

ALTER TABLE "admin_staff_invitations"
  ADD COLUMN IF NOT EXISTS "roles" text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE "admin_staff_invitations"
SET "roles" = ARRAY["role"]::text[]
WHERE cardinality("roles") = 0;
