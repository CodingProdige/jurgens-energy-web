import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { productVariants } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
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
});
