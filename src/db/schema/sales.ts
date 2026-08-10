import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { productVariants } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const saleCampaignStatus = pgEnum("sale_campaign_status", [
  "scheduled",
  "active",
  "ended",
]);

export const saleCampaignVariantStatus = pgEnum(
  "sale_campaign_variant_status",
  ["scheduled", "active", "ended"],
);

export const saleCampaigns = pgTable(
  "sale_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    publicHeadline: varchar("public_headline", { length: 200 }),
    badgeText: varchar("badge_text", { length: 80 }).notNull().default("Sale"),
    badgeColor: varchar("badge_color", { length: 7 })
      .notNull()
      .default("#FF5A1F"),
    badgeIcon: varchar("badge_icon", { length: 80 }),
    headerVisible: boolean("header_visible").notNull().default(true),
    headerPriority: smallint("header_priority").notNull().default(0),
    ctaLabel: varchar("cta_label", { length: 80 })
      .notNull()
      .default("Shop sale"),
    discountPercent: numeric("discount_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    status: saleCampaignStatus("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    activatedAt: timestamp("activated_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (campaign) => ({
    badgeColorCheck: check(
      "sale_campaigns_badge_color_check",
      sql`${campaign.badgeColor} ~ '^#[0-9A-F]{6}$'`,
    ),
    createdAtIdx: index("sale_campaigns_created_at_idx").on(campaign.createdAt),
    headerIdx: index("sale_campaigns_header_idx").on(
      campaign.status,
      campaign.headerVisible,
      campaign.headerPriority,
    ),
    lifecycleIdx: index("sale_campaigns_lifecycle_idx").on(
      campaign.status,
      campaign.startsAt,
      campaign.endsAt,
    ),
    scheduleWindowCheck: check(
      "sale_campaigns_schedule_window_check",
      sql`${campaign.endsAt} is null or ${campaign.endsAt} > ${campaign.startsAt}`,
    ),
    statusIdx: index("sale_campaigns_status_idx").on(campaign.status),
  }),
);

export const saleCampaignVariants = pgTable(
  "sale_campaign_variants",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => saleCampaigns.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    status: saleCampaignVariantStatus("status").notNull().default("active"),
    originalPrice: numeric("original_price", {
      precision: 12,
      scale: 2,
    }).notNull(),
    originalCompareAtPrice: numeric("original_compare_at_price", {
      precision: 12,
      scale: 2,
    }),
    salePrice: numeric("sale_price", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (item) => ({
    campaignIdx: index("sale_campaign_variants_campaign_id_idx").on(
      item.campaignId,
    ),
    oneActiveVariantIdx: uniqueIndex(
      "sale_campaign_variants_one_active_variant_idx",
    )
      .on(item.variantId)
      .where(sql`${item.status} = 'active'`),
    pk: primaryKey({ columns: [item.campaignId, item.variantId] }),
    statusIdx: index("sale_campaign_variants_status_idx").on(item.status),
    variantIdx: index("sale_campaign_variants_variant_id_idx").on(item.variantId),
  }),
);
