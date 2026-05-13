import {
  pgEnum,
  pgTable,
  timestamp,
  text,
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

export const sellerApplicationStatus = pgEnum("seller_application_status", [
  "pending",
  "approved",
  "rejected",
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

export const sellerApplications = pgTable(
  "seller_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    fullName: varchar("full_name", { length: 160 }),
    storeName: varchar("store_name", { length: 160 }).notNull(),
    storeSlug: varchar("store_slug", { length: 160 }).notNull().unique(),
    businessType: varchar("business_type", { length: 120 }).notNull(),
    countryRegion: varchar("country_region", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 240 }),
    city: varchar("city", { length: 120 }).notNull(),
    stateProvince: varchar("state_province", { length: 120 }).notNull(),
    postalCode: varchar("postal_code", { length: 40 }).notNull(),
    status: sellerApplicationStatus("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (application) => ({
    userUnique: unique("seller_applications_user_id_unique").on(
      application.userId,
    ),
  }),
);

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
