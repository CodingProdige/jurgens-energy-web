import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { products } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
