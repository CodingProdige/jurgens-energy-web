CREATE TABLE IF NOT EXISTS "storefront_pages" (
  "slug" varchar(80) PRIMARY KEY NOT NULL,
  "title" varchar(160) NOT NULL,
  "draft_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
