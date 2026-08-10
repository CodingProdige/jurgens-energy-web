import { and, desc, eq, or, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/src/db";
import {
  productVariants,
  products,
  saleCampaigns,
  saleCampaignVariants,
} from "@/src/db/schema";
import { lucideCampaignIconNames } from "@/src/generated/lucide-campaign-icon-names";
import { isMissingSalesSchemaError } from "@/src/modules/sales/database-errors";

const lucideCampaignIconNameSet = new Set<string>(lucideCampaignIconNames);

export type MarketplaceSaleCampaign = {
  badgeColor: string;
  badgeIcon: string | null;
  badgeText: string;
  createdAt: string;
  ctaLabel: string;
  discountPercent: string;
  headerPriority: number;
  headerVisible: boolean;
  href: string;
  id: string;
  name: string;
  productCount: number;
  productIds: string[];
  publicHeadline: string;
  variantCount: number;
  variantIds: string[];
};

type MarketplaceSaleCampaignRow = Omit<
  MarketplaceSaleCampaign,
  | "createdAt"
  | "href"
  | "productCount"
  | "productIds"
  | "publicHeadline"
  | "variantCount"
  | "variantIds"
> & {
  createdAt: Date;
  productId: string;
  publicHeadline: string | null;
  variantId: string;
};

export function createMarketplaceSaleCampaignHref(campaignId: string) {
  return `/sale?${new URLSearchParams({ campaign: campaignId }).toString()}`;
}

function groupMarketplaceSaleCampaigns(rows: MarketplaceSaleCampaignRow[]) {
  const campaignById = new Map<
    string,
    MarketplaceSaleCampaign & {
      productIdSet: Set<string>;
      variantIdSet: Set<string>;
    }
  >();

  for (const row of rows) {
    const campaign = campaignById.get(row.id) ?? {
      badgeColor: row.badgeColor.toUpperCase(),
      badgeIcon:
        row.badgeIcon && lucideCampaignIconNameSet.has(row.badgeIcon)
          ? row.badgeIcon
          : null,
      badgeText: row.badgeText,
      createdAt: row.createdAt.toISOString(),
      ctaLabel: row.ctaLabel,
      discountPercent: row.discountPercent,
      headerPriority: row.headerPriority,
      headerVisible: row.headerVisible,
      href: createMarketplaceSaleCampaignHref(row.id),
      id: row.id,
      name: row.name,
      productCount: 0,
      productIds: [],
      productIdSet: new Set<string>(),
      publicHeadline: row.publicHeadline?.trim() || row.name,
      variantCount: 0,
      variantIds: [],
      variantIdSet: new Set<string>(),
    };

    campaign.productIdSet.add(row.productId);
    campaign.variantIdSet.add(row.variantId);
    campaignById.set(row.id, campaign);
  }

  return Array.from(campaignById.values()).map(
    ({ productIdSet, variantIdSet, ...campaign }) => ({
      ...campaign,
      productCount: productIdSet.size,
      productIds: Array.from(productIdSet),
      variantCount: variantIdSet.size,
      variantIds: Array.from(variantIdSet),
    }),
  );
}

export const getActiveMarketplaceSaleCampaigns = cache(
  async (): Promise<MarketplaceSaleCampaign[]> => {
    let rows: MarketplaceSaleCampaignRow[];

    try {
      rows = await db
        .select({
          badgeColor: saleCampaigns.badgeColor,
          badgeIcon: saleCampaigns.badgeIcon,
          badgeText: saleCampaigns.badgeText,
          createdAt: saleCampaigns.createdAt,
          ctaLabel: saleCampaigns.ctaLabel,
          discountPercent: saleCampaigns.discountPercent,
          headerPriority: saleCampaigns.headerPriority,
          headerVisible: saleCampaigns.headerVisible,
          id: saleCampaigns.id,
          name: saleCampaigns.name,
          productId: products.id,
          publicHeadline: saleCampaigns.publicHeadline,
          variantId: productVariants.id,
        })
        .from(saleCampaigns)
        .innerJoin(
          saleCampaignVariants,
          eq(saleCampaignVariants.campaignId, saleCampaigns.id),
        )
        .innerJoin(
          productVariants,
          eq(productVariants.id, saleCampaignVariants.variantId),
        )
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(saleCampaigns.status, "active"),
            eq(saleCampaignVariants.status, "active"),
            eq(productVariants.status, "active"),
            eq(productVariants.isActive, true),
            or(eq(products.status, "active"), eq(products.status, "live")),
          ),
        )
        .orderBy(
          desc(saleCampaigns.headerPriority),
          desc(saleCampaigns.createdAt),
        );
    } catch (error: unknown) {
      if (isMissingSalesSchemaError(error)) {
        console.warn(
          "Sales campaign appearance is unavailable; hiding public campaigns until migrations finish.",
        );

        return [];
      }

      throw error;
    }

    return groupMarketplaceSaleCampaigns(rows);
  },
);

/**
 * Mirrors the public `/sale` eligibility rule and counts products, not variants.
 * Campaign discounts are represented by their active compare-at markdown while
 * deliberate compare-at markdowns outside a campaign are included as well.
 */
export const getMarketplaceSaleProductCount = cache(async () => {
  const [row] = await db
    .select({
      total: sql<number>`count(distinct ${products.id})::int`,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        or(eq(products.status, "live"), eq(products.status, "active")),
        eq(productVariants.status, "active"),
        eq(productVariants.isActive, true),
        sql`${productVariants.price} > 0`,
        sql`${productVariants.compareAtPrice} > ${productVariants.price}`,
      ),
    );

  return Number(row?.total) || 0;
});
