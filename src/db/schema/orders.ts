import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { brands, categories } from "@/src/db/schema/catalog";
import { productVariants } from "@/src/db/schema/products";
import { sellers } from "@/src/db/schema/sellers";
import { users } from "@/src/db/schema/users";

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  customerEmail: varchar("customer_email", { length: 254 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  deliveryAddressSnapshot: jsonb("delivery_address_snapshot")
    .$type<{
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      countryCode: string;
      postalCode: string;
      province: string;
      suburb: string;
    }>()
    .notNull(),
  checkoutTokenHash: varchar("checkout_token_hash", { length: 64 }),
  currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
  status: orderStatus("status").notNull().default("pending"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  shippingTotal: numeric("shipping_total", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").references(() => sellers.id, {
    onDelete: "set null",
  }),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  categoryId: uuid("category_id").references(() => categories.id),
  brandId: uuid("brand_id").references(() => brands.id),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  deliveryMethodSnapshot: varchar("delivery_method_snapshot", { length: 32 }),
  deliveryLabelSnapshot: text("delivery_label_snapshot"),
  purchaseType: varchar("purchase_type", { length: 32 })
    .notNull()
    .default("standard"),
  exchangeEmptyConfirmed: boolean("exchange_empty_confirmed")
    .notNull()
    .default(false),
  exchangeReturnBrand: varchar("exchange_return_brand", { length: 120 }),
  exchangeRequiredEmptyCylinderSize: varchar(
    "exchange_required_empty_cylinder_size",
    { length: 80 },
  ),
  exchangeAcceptedReturnBrandsSnapshot: jsonb(
    "exchange_accepted_return_brands_snapshot",
  )
    .$type<string[]>()
    .notNull()
    .default([]),
  exchangeConfirmationTextSnapshot: text("exchange_confirmation_text_snapshot"),
  commissionRateBps: integer("commission_rate_bps"),
  commissionAmount: numeric("commission_amount", {
    precision: 12,
    scale: 2,
  }),
});
