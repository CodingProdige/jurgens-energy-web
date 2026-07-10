import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { media } from "@/src/db/schema/media";
import { users } from "@/src/db/schema/users";

export const blogPostStatuses = [
  "draft",
  "published",
  "scheduled",
  "archived",
] as const;

export type BlogPostStatus = (typeof blogPostStatuses)[number];

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull().default(""),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 })
      .$type<BlogPostStatus>()
      .notNull()
      .default("draft"),
    seoTitle: varchar("seo_title", { length: 180 }),
    seoDescription: varchar("seo_description", { length: 300 }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (post) => ({
    authorIdx: index("blog_posts_author_user_id_idx").on(post.authorUserId),
    publishedAtIdx: index("blog_posts_published_at_idx").on(post.publishedAt),
    slugUnique: uniqueIndex("blog_posts_slug_unique").on(post.slug),
    statusIdx: index("blog_posts_status_idx").on(post.status),
  }),
);
