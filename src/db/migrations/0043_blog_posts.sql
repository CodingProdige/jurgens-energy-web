CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(180) NOT NULL,
  "slug" varchar(180) NOT NULL,
  "excerpt" text,
  "content" text DEFAULT '' NOT NULL,
  "cover_media_id" uuid REFERENCES "media"("id") ON DELETE set null,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "seo_title" varchar(180),
  "seo_description" varchar(300),
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_unique"
  ON "blog_posts" ("slug");

CREATE INDEX IF NOT EXISTS "blog_posts_author_user_id_idx"
  ON "blog_posts" ("author_user_id");

CREATE INDEX IF NOT EXISTS "blog_posts_published_at_idx"
  ON "blog_posts" ("published_at");

CREATE INDEX IF NOT EXISTS "blog_posts_status_idx"
  ON "blog_posts" ("status");
