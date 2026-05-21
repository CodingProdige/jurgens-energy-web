import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sellers } from "@/src/db/schema/sellers";
import { users } from "@/src/db/schema/users";

export const subscriptionScope = pgEnum("subscription_scope", [
  "user",
  "seller",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
]);

export const subscriptionMode = pgEnum("subscription_mode", [
  "sandbox",
  "live",
]);

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    scope: subscriptionScope("scope").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    billingInterval: varchar("billing_interval", { length: 32 })
      .notNull()
      .default("month"),
    storageQuotaMb: integer("storage_quota_mb").notNull().default(5120),
    featureBullets: text("feature_bullets").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    isHighlighted: boolean("is_highlighted").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    stripeLiveProductId: varchar("stripe_live_product_id", { length: 255 }),
    stripeLivePriceId: varchar("stripe_live_price_id", { length: 255 }),
    stripeSandboxProductId: varchar("stripe_sandbox_product_id", {
      length: 255,
    }),
    stripeSandboxPriceId: varchar("stripe_sandbox_price_id", { length: 255 }),
    stripeSyncedAt: timestamp("stripe_synced_at", { mode: "date" }),
    stripeSyncError: text("stripe_sync_error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (plan) => ({
    codeUnique: uniqueIndex("subscription_plans_code_unique").on(plan.code),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sellerId: uuid("seller_id").references(() => sellers.id, {
      onDelete: "cascade",
    }),
    mode: subscriptionMode("mode").notNull().default("sandbox"),
    status: subscriptionStatus("status").notNull().default("incomplete"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (subscription) => ({
    stripeSubscriptionUnique: uniqueIndex(
      "subscriptions_stripe_subscription_id_unique",
    ).on(subscription.stripeSubscriptionId),
  }),
);
