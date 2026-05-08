import { numeric, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { orderItems } from "@/src/db/schema/orders";
import { sellers } from "@/src/db/schema/sellers";

export const payoutStatus = pgEnum("payout_status", [
  "pending",
  "approved",
  "paid",
  "failed",
]);

export const commissions = pgTable("commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellers.id),
  status: payoutStatus("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
