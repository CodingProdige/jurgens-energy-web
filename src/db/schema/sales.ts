import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { productVariants } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const saleCampaignStatus = pgEnum("sale_campaign_status", [
  "active",
  "ended",
]);

export const saleCampaignVariantStatus = pgEnum(
  "sale_campaign_variant_status",
  ["active", "ended"],
);

export const saleCampaigns = pgTable(
  "sale_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    badgeText: varchar("badge_text", { length: 80 }).notNull().default("Sale"),
    discountPercent: numeric("discount_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    status: saleCampaignStatus("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (campaign) => ({
    createdAtIdx: index("sale_campaigns_created_at_idx").on(campaign.createdAt),
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
