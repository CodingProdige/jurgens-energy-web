import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  index,
  integer,
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { media } from "@/src/db/schema/media";
import { sellers } from "@/src/db/schema/sellers";
import { users } from "@/src/db/schema/users";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => categories.id,
      { onDelete: "restrict" },
    ),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    path: varchar("path", { length: 760 }).notNull(),
    depth: integer("depth").notNull().default(0),
    description: text("description"),
    commissionRateBps: integer("commission_rate_bps"),
    isLocked: boolean("is_locked").notNull().default(false),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (category) => ({
    parentIdx: index("categories_parent_id_idx").on(category.parentId),
    pathUnique: uniqueIndex("categories_path_unique").on(category.path),
    slugIdx: index("categories_slug_idx").on(category.slug),
    statusIdx: index("categories_status_idx").on(category.status),
  }),
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description"),
    websiteUrl: text("website_url"),
    logoMediaId: uuid("logo_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (brand) => ({
    slugUnique: uniqueIndex("brands_slug_unique").on(brand.slug),
    statusIdx: index("brands_status_idx").on(brand.status),
  }),
);

export const brandRequests = pgTable(
  "brand_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id").references(() => sellers.id, {
      onDelete: "set null",
    }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    brandName: varchar("brand_name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    websiteUrl: text("website_url"),
    notes: text("notes"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (request) => ({
    sellerSlugUnique: unique("brand_requests_seller_id_slug_unique").on(
      request.sellerId,
      request.slug,
    ),
    statusIdx: index("brand_requests_status_idx").on(request.status),
    slugIdx: index("brand_requests_slug_idx").on(request.slug),
  }),
);
