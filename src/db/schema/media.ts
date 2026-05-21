import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sellers } from "@/src/db/schema/sellers";
import { users } from "@/src/db/schema/users";

export const mediaFolders = pgTable("media_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  sellerId: uuid("seller_id").references(() => sellers.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sellerId: uuid("seller_id").references(() => sellers.id, {
      onDelete: "set null",
    }),
    folderId: uuid("folder_id").references(() => mediaFolders.id, {
      onDelete: "set null",
    }),
    originalFileName: varchar("original_file_name", { length: 255 }),
    relativePath: text("relative_path").notNull(),
    thumbnailRelativePath: text("thumbnail_relative_path"),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    originalMimeType: varchar("original_mime_type", { length: 120 }),
    byteSize: integer("byte_size").notNull(),
    originalByteSize: integer("original_byte_size"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    contentHash: varchar("content_hash", { length: 128 }),
    altText: text("alt_text"),
    tags: text("tags"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (asset) => ({
    folderIdx: index("media_folder_id_idx").on(asset.folderId),
    ownerIdx: index("media_owner_user_id_idx").on(asset.ownerUserId),
    sellerIdx: index("media_seller_id_idx").on(asset.sellerId),
    hashIdx: index("media_content_hash_idx").on(asset.contentHash),
  }),
);

export const mediaFolderAssignments = pgTable(
  "media_folder_assignments",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => mediaFolders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (assignment) => ({
    folderIdx: index("media_folder_assignments_folder_id_idx").on(
      assignment.folderId,
    ),
    pk: primaryKey({
      columns: [assignment.mediaId, assignment.folderId],
    }),
  }),
);
