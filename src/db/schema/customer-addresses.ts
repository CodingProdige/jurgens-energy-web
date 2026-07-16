import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@/src/db/schema/users";

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    recipientName: varchar("recipient_name", { length: 160 }).notNull(),
    recipientPhone: varchar("recipient_phone", { length: 40 }).notNull(),
    addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 240 }),
    suburb: varchar("suburb", { length: 120 }),
    city: varchar("city", { length: 120 }).notNull(),
    province: varchar("province", { length: 120 }).notNull(),
    postalCode: varchar("postal_code", { length: 40 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("ZA"),
    isDefault: boolean("is_default").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (address) => ({
    defaultUnique: uniqueIndex("customer_addresses_user_default_unique")
      .on(address.userId)
      .where(sql`${address.isDefault} = true`),
    userIdx: index("customer_addresses_user_id_idx").on(address.userId),
    userLastUsedIdx: index("customer_addresses_user_last_used_idx").on(
      address.userId,
      address.lastUsedAt,
    ),
  }),
);
