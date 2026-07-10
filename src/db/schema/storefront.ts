import {
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import type { StorefrontSection } from "@/src/modules/marketplace/storefront-types";

export const storefrontPages = pgTable("storefront_pages", {
  slug: varchar("slug", { length: 80 }).primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  draftSections: jsonb("draft_sections")
    .$type<StorefrontSection[]>()
    .notNull()
    .default([]),
  publishedSections: jsonb("published_sections")
    .$type<StorefrontSection[]>()
    .notNull()
    .default([]),
  publishedAt: timestamp("published_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
