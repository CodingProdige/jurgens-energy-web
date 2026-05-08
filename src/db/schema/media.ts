import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { sellers } from "@/src/db/schema/sellers";
import { users } from "@/src/db/schema/users";

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  sellerId: uuid("seller_id").references(() => sellers.id),
  relativePath: text("relative_path").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  altText: text("alt_text"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
