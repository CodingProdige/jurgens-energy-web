import { and, count, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orderItems,
  products,
  sellerFulfillmentProfiles,
  sellerStaff,
  sellers,
  shipments,
} from "@/src/db/schema";

export async function getPrimarySellerForUser(userId: string) {
  const [ownedSeller] = await db
    .select({
      id: sellers.id,
      displayName: sellers.displayName,
      slug: sellers.slug,
      status: sellers.status,
    })
    .from(sellers)
    .where(eq(sellers.ownerUserId, userId))
    .limit(1);

  if (ownedSeller) {
    return ownedSeller;
  }

  const [staffSeller] = await db
    .select({
      id: sellers.id,
      displayName: sellers.displayName,
      slug: sellers.slug,
      status: sellers.status,
    })
    .from(sellerStaff)
    .innerJoin(sellers, eq(sellers.id, sellerStaff.sellerId))
    .where(eq(sellerStaff.userId, userId))
    .limit(1);

  return staffSeller ?? null;
}

export async function getSellerDashboardOverview(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return {
      seller: {
        id: "none",
        displayName: "Seller",
        slug: "seller",
        status: "pending",
      },
      fulfillmentProfile: null,
      products: { total: 0, active: 0, drafts: 0 },
      orders: { total: 0 },
      shipments: { open: 0, waybillReady: 0 },
      payouts: { total: 0 },
    };
  }

  const [
    [productTotal],
    [activeProductTotal],
    [draftProductTotal],
    [orderTotal],
    [openShipmentTotal],
    [waybillReadyTotal],
    [fulfillmentProfile],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(products)
      .where(eq(products.sellerId, seller.id)),
    db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.sellerId, seller.id), eq(products.status, "active"))),
    db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.sellerId, seller.id), eq(products.status, "draft"))),
    db
      .select({ value: count() })
      .from(orderItems)
      .where(eq(orderItems.sellerId, seller.id)),
    db
      .select({ value: count() })
      .from(shipments)
      .where(
        and(
          eq(shipments.sellerId, seller.id),
          ne(shipments.status, "delivered"),
          ne(shipments.status, "failed_delivery"),
          ne(shipments.status, "returned"),
          ne(shipments.status, "cancelled"),
        ),
      ),
    db
      .select({ value: count() })
      .from(shipments)
      .where(
        and(
          eq(shipments.sellerId, seller.id),
          inArray(shipments.status, ["waybill_ready", "ready_for_collection"]),
        ),
      ),
    db
      .select({
        id: sellerFulfillmentProfiles.id,
        isVerified: sellerFulfillmentProfiles.isVerified,
      })
      .from(sellerFulfillmentProfiles)
      .where(eq(sellerFulfillmentProfiles.sellerId, seller.id))
      .limit(1),
  ]);

  return {
    seller,
    fulfillmentProfile: fulfillmentProfile ?? null,
    products: {
      total: productTotal?.value ?? 0,
      active: activeProductTotal?.value ?? 0,
      drafts: draftProductTotal?.value ?? 0,
    },
    orders: {
      total: orderTotal?.value ?? 0,
    },
    shipments: {
      open: openShipmentTotal?.value ?? 0,
      waybillReady: waybillReadyTotal?.value ?? 0,
    },
    payouts: {
      total: 0,
    },
  };
}
