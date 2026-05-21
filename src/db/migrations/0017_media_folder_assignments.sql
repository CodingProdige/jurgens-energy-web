CREATE TABLE IF NOT EXISTS "media_folder_assignments" (
  "media_id" uuid NOT NULL REFERENCES "media"("id") ON DELETE cascade,
  "folder_id" uuid NOT NULL REFERENCES "media_folders"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "media_folder_assignments_media_id_folder_id_pk" PRIMARY KEY("media_id","folder_id")
);

CREATE INDEX IF NOT EXISTS "media_folder_assignments_folder_id_idx"
  ON "media_folder_assignments" ("folder_id");

INSERT INTO "media_folder_assignments" ("media_id", "folder_id")
SELECT "id", "folder_id"
FROM "media"
WHERE "folder_id" IS NOT NULL
ON CONFLICT DO NOTHING;
