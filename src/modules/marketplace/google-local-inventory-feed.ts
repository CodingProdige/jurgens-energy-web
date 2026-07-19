import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  marketplaceSettings,
  productVariants,
  products,
} from "@/src/db/schema";
import {
  getGoogleLocalInventoryAvailability,
  normalizeGoogleLocalInventoryStoreCode,
  type GoogleLocalInventoryAvailability,
} from "@/src/modules/marketplace/google-feed-utils";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

const publicProductStatuses = ["live", "active"] as const;
const googleFeedCurrency = "ZAR";

export type GoogleLocalInventoryFeedState =
  | "disabled"
  | "invalid_store_code"
  | "missing_store_code"
  | "not_customer_accessible"
  | "ready";

export type GoogleLocalInventoryFeedItem = {
  availability: GoogleLocalInventoryAvailability;
  id: string;
  price: string;
  storeCode: string;
};

export type GoogleLocalInventoryFeedResult = {
  feed: string;
  itemCount: number;
  state: GoogleLocalInventoryFeedState;
};

export async function renderGoogleLocalInventoryFeed(): Promise<GoogleLocalInventoryFeedResult> {
  const configuration = await getGoogleLocalInventoryConfiguration();

  if (configuration.state !== "ready") {
    return {
      feed: renderGoogleLocalInventoryFeedDocument({
        items: [],
        state: configuration.state,
      }),
      itemCount: 0,
      state: configuration.state,
    };
  }

  const items = await getGoogleLocalInventoryFeedItems(
    configuration.storeCode,
  );

  return {
    feed: renderGoogleLocalInventoryFeedDocument({ items, state: "ready" }),
    itemCount: items.length,
    state: "ready",
  };
}

async function getGoogleLocalInventoryConfiguration(): Promise<
  | {
      state: Exclude<GoogleLocalInventoryFeedState, "ready">;
    }
  | {
      state: "ready";
      storeCode: string;
    }
> {
  const [settings] = await db
    .select({
      customerAccessible:
        marketplaceSettings.googleLocalInventoryCustomerAccessible,
      enabled: marketplaceSettings.googleLocalInventoryEnabled,
      storeCode: marketplaceSettings.googleLocalInventoryStoreCode,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  if (!settings?.enabled) {
    return { state: "disabled" };
  }

  const rawStoreCode = settings.storeCode?.trim() ?? "";

  if (!rawStoreCode) {
    return { state: "missing_store_code" };
  }

  const storeCode = normalizeGoogleLocalInventoryStoreCode(rawStoreCode);

  if (!storeCode) {
    return { state: "invalid_store_code" };
  }

  if (!settings.customerAccessible) {
    return { state: "not_customer_accessible" };
  }

  return { state: "ready", storeCode };
}

async function getGoogleLocalInventoryFeedItems(
  storeCode: string,
): Promise<GoogleLocalInventoryFeedItem[]> {
  const rows = await db
    .select({
      id: productVariants.id,
      price: productVariants.price,
      stockOnHand: productVariants.stockOnHand,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        inArray(products.status, publicProductStatuses),
        eq(productVariants.status, "active"),
        eq(productVariants.isActive, true),
        eq(productVariants.googleFulfillmentChannel, "local_lpg"),
      ),
    )
    .orderBy(asc(productVariants.id));

  return rows.flatMap((row): GoogleLocalInventoryFeedItem[] => {
    const price = Number(row.price);

    if (!Number.isFinite(price) || price <= 0) {
      return [];
    }

    return [
      {
        availability: getGoogleLocalInventoryAvailability(row.stockOnHand),
        id: row.id,
        price: formatGooglePrice(price),
        storeCode,
      },
    ];
  });
}

function renderGoogleLocalInventoryFeedDocument(input: {
  items: GoogleLocalInventoryFeedItem[];
  state: GoogleLocalInventoryFeedState;
}) {
  const storeUrl = createMarketplaceCanonicalUrl("/");
  const description = getGoogleLocalInventoryDescription(input.state);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    "    <title>Jurgens Energy Local Inventory</title>",
    `    <link>${escapeXml(storeUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    ...input.items.flatMap(renderGoogleLocalInventoryFeedItem),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

function renderGoogleLocalInventoryFeedItem(
  item: GoogleLocalInventoryFeedItem,
) {
  return [
    "    <item>",
    `      <g:id>${escapeXml(item.id)}</g:id>`,
    `      <g:store_code>${escapeXml(item.storeCode)}</g:store_code>`,
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:price>${escapeXml(item.price)}</g:price>`,
    "    </item>",
  ];
}

function getGoogleLocalInventoryDescription(
  state: GoogleLocalInventoryFeedState,
) {
  switch (state) {
    case "ready":
      return "Current Jurgens Energy store-level product availability and pricing.";
    case "disabled":
      return "Local inventory publishing is disabled in marketplace settings.";
    case "missing_store_code":
      return "Local inventory publishing requires a Google Business Profile store code.";
    case "invalid_store_code":
      return "The configured Google Business Profile store code is invalid.";
    case "not_customer_accessible":
      return "Local inventory publishing requires a customer-accessible business location.";
  }
}

function formatGooglePrice(value: number) {
  return `${value.toFixed(2)} ${googleFeedCurrency}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
