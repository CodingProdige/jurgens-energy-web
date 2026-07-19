import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "@/src/db/schema/users";

export const staticPageSeo = pgTable("static_page_seo", {
  pageKey: varchar("page_key", { length: 80 }).primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),
  description: varchar("description", { length: 320 }).notNull(),
  source: varchar("source", { length: 24 })
    .$type<"ai" | "manual" | "restore">()
    .notNull()
    .default("manual"),
  isCustomized: boolean("is_customized").notNull().default(true),
  lastScannedAt: timestamp("last_scanned_at", { mode: "date" }),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const staticPageSeoRevisions = pgTable(
  "static_page_seo_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageKey: varchar("page_key", { length: 80 })
      .notNull()
      .references(() => staticPageSeo.pageKey, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    description: varchar("description", { length: 320 }).notNull(),
    source: varchar("source", { length: 24 })
      .$type<"ai" | "default" | "manual" | "restore">()
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    restoredFromRevisionId: uuid("restored_from_revision_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (revision) => ({
    pageCreatedAtIdx: index("static_page_seo_revisions_page_created_at_idx").on(
      revision.pageKey,
      revision.createdAt,
    ),
    oneDefaultRevisionIdx: uniqueIndex(
      "static_page_seo_revisions_one_default_idx",
    )
      .on(revision.pageKey)
      .where(sql`${revision.source} = 'default'`),
  }),
);
