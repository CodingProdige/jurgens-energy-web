CREATE TABLE IF NOT EXISTS "static_page_seo" (
  "page_key" varchar(80) PRIMARY KEY NOT NULL,
  "title" varchar(120) NOT NULL,
  "description" varchar(320) NOT NULL,
  "source" varchar(24) DEFAULT 'manual' NOT NULL,
  "is_customized" boolean DEFAULT true NOT NULL,
  "last_scanned_at" timestamp,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "static_page_seo_page_key_check" CHECK (
    "page_key" IN (
      'home',
      'products',
      'brands',
      'blog',
      'about',
      'contact',
      'faq',
      'lpg-delivery',
      'lpg-safety',
      'delivery-information',
      'privacy-policy',
      'returns-and-refunds',
      'terms-and-conditions'
    )
  ),
  CONSTRAINT "static_page_seo_source_check" CHECK (
    "source" IN ('ai', 'manual', 'restore')
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "static_page_seo_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_key" varchar(80) NOT NULL REFERENCES "static_page_seo"("page_key") ON DELETE cascade,
  "title" varchar(120) NOT NULL,
  "description" varchar(320) NOT NULL,
  "source" varchar(24) NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "restored_from_revision_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "static_page_seo_revisions_source_check" CHECK (
    "source" IN ('ai', 'default', 'manual', 'restore')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "static_page_seo_revisions_page_created_at_idx"
  ON "static_page_seo_revisions" ("page_key", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "static_page_seo_revisions_one_default_idx"
  ON "static_page_seo_revisions" ("page_key")
  WHERE "source" = 'default';
