import {
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@/src/db/schema/users";

export const sellerStatus = pgEnum("seller_status", [
  "pending",
  "active",
  "suspended",
]);

export const sellers = pgTable("sellers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  status: sellerStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const sellerStaff = pgTable(
  "seller_staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 64 }).notNull().default("staff"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (staff) => ({
    sellerUserUnique: unique("seller_staff_seller_id_user_id_unique").on(
      staff.sellerId,
      staff.userId,
    ),
  }),
);
