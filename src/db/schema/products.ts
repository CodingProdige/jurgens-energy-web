import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { brandRequests, brands, categories } from "@/src/db/schema/catalog";
import { media } from "@/src/db/schema/media";
import { sellers } from "@/src/db/schema/sellers";
import { sellerParcelPresets } from "@/src/db/schema/shipping";
import { users } from "@/src/db/schema/users";

export const productStatus = pgEnum("product_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "live",
  "paused",
  "admin_suspended",
  "active",
  "archived",
]);

export const productFulfillmentMode = pgEnum("product_fulfillment_mode", [
  "seller_fulfilled",
  "piessang_fulfilled",
]);

export const googleFulfillmentChannel = pgEnum("google_fulfillment_channel", [
  "local_lpg",
  "national_courier",
  "excluded",
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id").references(() => sellers.id, {
    onDelete: "set null",
  }),
  categoryId: uuid("category_id").references(() => categories.id),
  brandId: uuid("brand_id").references(() => brands.id),
  brandRequestId: uuid("brand_request_id").references(() => brandRequests.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 240 }).notNull(),
  slug: varchar("slug", { length: 240 }).notNull().unique(),
  shortDescription: text("short_description"),
  description: text("description"),
  fullDescription: text("full_description"),
  barcode: varchar("barcode", { length: 120 }),
  optionSchema: jsonb("option_schema").$type<Array<{
    name: string;
    values: string[];
  }>>(),
  status: productStatus("status").notNull().default("draft"),
  fulfillmentMode: productFulfillmentMode("fulfillment_mode")
    .notNull()
    .default("seller_fulfilled"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),
    optionValues: jsonb("option_values").$type<string[]>().notNull().default([]),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    googleFulfillmentChannel: googleFulfillmentChannel(
      "google_fulfillment_channel",
    )
      .notNull()
      .default("local_lpg"),
    manufacturerMpn: varchar("manufacturer_mpn", { length: 70 }),
    googleReturnPolicyLabel: varchar("google_return_policy_label", {
      length: 100,
    }),
    taxRateBps: integer("tax_rate_bps").notNull().default(1500),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    lowStockAlert: integer("low_stock_alert").notNull().default(5),
    continueSellingOutOfStock: boolean("continue_selling_out_of_stock")
      .notNull()
      .default(false),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    barcode: varchar("barcode", { length: 120 }),
    mediaId: uuid("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    parcelPresetId: uuid("parcel_preset_id").references(
      () => sellerParcelPresets.id,
      {
        onDelete: "set null",
      },
    ),
    weightGrams: numeric("weight_grams", {
      mode: "number",
      precision: 12,
      scale: 3,
    }),
    lengthMm: numeric("length_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }),
    widthMm: numeric("width_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }),
    heightMm: numeric("height_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }),
    shipsAlone: boolean("ships_alone").notNull().default(false),
    isFragile: boolean("is_fragile").notNull().default(false),
    requiresExchangeEmpty: boolean("requires_exchange_empty")
      .notNull()
      .default(false),
    exchangeEmptyCylinderSize: varchar("exchange_empty_cylinder_size", {
      length: 80,
    }),
    exchangeAcceptedReturnBrands: jsonb("exchange_accepted_return_brands")
      .$type<string[]>()
      .notNull()
      .default([]),
    exchangeConfirmationText: text("exchange_confirmation_text"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (variant) => ({
    costPriceNonNegativeCheck: check(
      "product_variants_cost_price_non_negative_check",
      sql`${variant.costPrice} is null or ${variant.costPrice} >= 0`,
    ),
    googleFulfillmentChannelIdx: index(
      "product_variants_google_fulfillment_channel_idx",
    ).on(variant.googleFulfillmentChannel),
    mediaIdx: index("product_variants_media_id_idx").on(variant.mediaId),
    parcelPresetIdx: index("product_variants_parcel_preset_id_idx").on(
      variant.parcelPresetId,
    ),
    productIdx: index("product_variants_product_id_idx").on(variant.productId),
    statusIdx: index("product_variants_status_idx").on(variant.status),
  }),
);

export const productMedia = pgTable(
  "product_media",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (item) => ({
    mediaIdx: index("product_media_media_id_idx").on(item.mediaId),
    pk: primaryKey({ columns: [item.productId, item.mediaId] }),
    sortIdx: index("product_media_product_sort_idx").on(
      item.productId,
      item.sortOrder,
    ),
  }),
);

export const productReviewEvents = pgTable(
  "product_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fromStatus: productStatus("from_status"),
    toStatus: productStatus("to_status").notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (event) => ({
    actorIdx: index("product_review_events_actor_user_id_idx").on(
      event.actorUserId,
    ),
    productIdx: index("product_review_events_product_id_idx").on(event.productId),
    productCreatedIdx: index("product_review_events_product_created_idx").on(
      event.productId,
      event.createdAt,
    ),
  }),
);
