import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { orderItems, orders } from "@/src/db/schema/orders";
import { products } from "@/src/db/schema/products";
import { productVariants } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const productReviewStatuses = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;

export type ProductReviewStatus = (typeof productReviewStatuses)[number];

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customerDisplayName: varchar("customer_display_name", {
      length: 120,
    }),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 140 }),
    body: text("body"),
    status: varchar("status", { length: 32 })
      .$type<ProductReviewStatus>()
      .notNull()
      .default("pending"),
    isVerifiedPurchase: boolean("is_verified_purchase")
      .notNull()
      .default(false),
    moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    rejectedAt: timestamp("rejected_at", { mode: "date" }),
    rejectedReason: text("rejected_reason"),
    hiddenAt: timestamp("hidden_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (review) => ({
    orderItemUserUnique: unique("reviews_order_item_user_id_unique").on(
      review.orderItemId,
      review.userId,
    ),
    productStatusIdx: index("reviews_product_status_idx").on(
      review.productId,
      review.status,
    ),
    statusCreatedIdx: index("reviews_status_created_at_idx").on(
      review.status,
      review.createdAt,
    ),
    userOrderIdx: index("reviews_user_order_idx").on(
      review.userId,
      review.orderId,
    ),
    variantIdx: index("reviews_variant_id_idx").on(review.variantId),
    ratingRangeCheck: check(
      "reviews_rating_range_check",
      sql`${review.rating} between 1 and 5`,
    ),
    statusCheck: check(
      "reviews_status_check",
      sql`${review.status} in ('pending', 'approved', 'rejected', 'hidden')`,
    ),
  }),
);

export const productReviewSummaries = pgTable("product_review_summaries", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  averageRating: numeric("average_rating", {
    precision: 3,
    scale: 2,
  })
    .notNull()
    .default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  ratingCount1: integer("rating_count_1").notNull().default(0),
  ratingCount2: integer("rating_count_2").notNull().default(0),
  ratingCount3: integer("rating_count_3").notNull().default(0),
  ratingCount4: integer("rating_count_4").notNull().default(0),
  ratingCount5: integer("rating_count_5").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
