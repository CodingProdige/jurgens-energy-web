import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { orders } from "@/src/db/schema/orders";
import { users } from "@/src/db/schema/users";
import {
  checkoutAnalyticsDeviceCategories,
  checkoutAnalyticsEventNames,
  checkoutAnalyticsSessionStatuses,
} from "@/src/modules/analytics/checkout-contracts";
import type { CampaignAttributionSnapshot } from "@/src/modules/marketing/campaign-attribution";

export const checkoutAnalyticsEventName = pgEnum(
  "checkout_analytics_event_name",
  checkoutAnalyticsEventNames,
);

export const checkoutAnalyticsSessionStatus = pgEnum(
  "checkout_analytics_session_status",
  checkoutAnalyticsSessionStatuses,
);

export const checkoutAnalyticsDeviceCategory = pgEnum(
  "checkout_analytics_device_category",
  checkoutAnalyticsDeviceCategories,
);

export const checkoutAnalyticsSessions = pgTable(
  "checkout_analytics_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    status: checkoutAnalyticsSessionStatus("status")
      .notNull()
      .default("active"),
    latestStep: checkoutAnalyticsEventName("latest_step").notNull(),
    campaignAttributionSnapshot: jsonb(
      "campaign_attribution_snapshot",
    ).$type<CampaignAttributionSnapshot>(),
    cartValue: numeric("cart_value", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    itemCount: integer("item_count"),
    totalQuantity: integer("total_quantity"),
    landingPath: varchar("landing_path", { length: 2_048 }),
    referrerHost: varchar("referrer_host", { length: 253 }),
    deviceCategory: checkoutAnalyticsDeviceCategory("device_category")
      .notNull()
      .default("unknown"),
    lastErrorCode: varchar("last_error_code", { length: 120 }),
    firstSeenAt: timestamp("first_seen_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (session) => ({
    cartValueNonnegative: check(
      "checkout_analytics_sessions_cart_value_nonnegative_check",
      sql`${session.cartValue} IS NULL OR ${session.cartValue} >= 0`,
    ),
    completedAtIdx: index(
      "checkout_analytics_sessions_completed_at_idx",
    ).on(session.completedAt),
    firstSeenAtIdx: index("checkout_analytics_sessions_first_seen_at_idx").on(
      session.firstSeenAt,
    ),
    itemCountNonnegative: check(
      "checkout_analytics_sessions_item_count_nonnegative_check",
      sql`${session.itemCount} IS NULL OR ${session.itemCount} >= 0`,
    ),
    lastSeenAtIdx: index("checkout_analytics_sessions_last_seen_at_idx").on(
      session.lastSeenAt,
    ),
    orderIdx: index("checkout_analytics_sessions_order_id_idx").on(
      session.orderId,
    ),
    statusLastSeenIdx: index(
      "checkout_analytics_sessions_status_last_seen_at_idx",
    ).on(session.status, session.lastSeenAt),
    totalQuantityNonnegative: check(
      "checkout_analytics_sessions_total_quantity_nonnegative_check",
      sql`${session.totalQuantity} IS NULL OR ${session.totalQuantity} >= 0`,
    ),
  }),
);

export const checkoutAnalyticsEvents = pgTable(
  "checkout_analytics_events",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => checkoutAnalyticsSessions.id, { onDelete: "cascade" }),
    eventName: checkoutAnalyticsEventName("event_name").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    cartValue: numeric("cart_value", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    itemCount: integer("item_count"),
    totalQuantity: integer("total_quantity"),
    errorCode: varchar("error_code", { length: 120 }),
    occurredAt: timestamp("occurred_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (event) => ({
    cartValueNonnegative: check(
      "checkout_analytics_events_cart_value_nonnegative_check",
      sql`${event.cartValue} IS NULL OR ${event.cartValue} >= 0`,
    ),
    eventOccurredAtIdx: index(
      "checkout_analytics_events_event_name_occurred_at_idx",
    ).on(event.eventName, event.occurredAt),
    itemCountNonnegative: check(
      "checkout_analytics_events_item_count_nonnegative_check",
      sql`${event.itemCount} IS NULL OR ${event.itemCount} >= 0`,
    ),
    occurredAtIdx: index("checkout_analytics_events_occurred_at_idx").on(
      event.occurredAt,
    ),
    orderOccurredAtIdx: index(
      "checkout_analytics_events_order_id_occurred_at_idx",
    ).on(event.orderId, event.occurredAt),
    sessionOccurredAtIdx: index(
      "checkout_analytics_events_session_id_occurred_at_idx",
    ).on(event.sessionId, event.occurredAt),
    totalQuantityNonnegative: check(
      "checkout_analytics_events_total_quantity_nonnegative_check",
      sql`${event.totalQuantity} IS NULL OR ${event.totalQuantity} >= 0`,
    ),
  }),
);
