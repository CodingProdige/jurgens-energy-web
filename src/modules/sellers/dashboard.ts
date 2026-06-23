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

export type SellerSetupStep = {
  actionLabel: string | null;
  complete: boolean;
  description: string;
  href: string | null;
  id: "seller_profile" | "collection_profile" | "products";
  title: string;
};

export type SellerSetupState = {
  attentionHrefs: string[];
  complete: boolean;
  steps: SellerSetupStep[];
};

export async function getPrimarySellerForUser(userId: string) {
  const [ownedSeller] = await db
    .select({
      id: sellers.id,
      displayName: sellers.displayName,
      isPiessangFulfillmentEnabled: sellers.isPiessangFulfillmentEnabled,
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
      isPiessangFulfillmentEnabled: sellers.isPiessangFulfillmentEnabled,
      slug: sellers.slug,
      status: sellers.status,
    })
    .from(sellerStaff)
    .innerJoin(sellers, eq(sellers.id, sellerStaff.sellerId))
    .where(eq(sellerStaff.userId, userId))
    .limit(1);

  return staffSeller ?? null;
}

export async function getSellerSetupState(userId: string): Promise<SellerSetupState> {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return buildSellerSetupState({
      hasCompleteCollectionProfile: false,
      readyProducts: 0,
      sellerStatus: null,
    });
  }

  const [[collectionProfile], [readyProductTotal]] =
    await Promise.all([
      db
        .select({
          addressLine1: sellerFulfillmentProfiles.addressLine1,
          city: sellerFulfillmentProfiles.city,
          contactEmail: sellerFulfillmentProfiles.contactEmail,
          contactName: sellerFulfillmentProfiles.contactName,
          contactPhone: sellerFulfillmentProfiles.contactPhone,
          id: sellerFulfillmentProfiles.id,
          postalCode: sellerFulfillmentProfiles.postalCode,
          province: sellerFulfillmentProfiles.province,
          suburb: sellerFulfillmentProfiles.suburb,
        })
        .from(sellerFulfillmentProfiles)
        .where(eq(sellerFulfillmentProfiles.sellerId, seller.id))
        .limit(1),
      db
        .select({ value: count() })
        .from(products)
        .where(
          and(
            eq(products.sellerId, seller.id),
            inArray(products.status, ["active", "live"]),
          ),
        ),
    ]);

  return buildSellerSetupState({
    hasCompleteCollectionProfile: Boolean(
      collectionProfile?.id &&
        collectionProfile.contactName &&
        collectionProfile.contactPhone &&
        collectionProfile.contactEmail &&
        collectionProfile.addressLine1 &&
        collectionProfile.suburb &&
        collectionProfile.city &&
        collectionProfile.province &&
        collectionProfile.postalCode,
    ),
    readyProducts: readyProductTotal?.value ?? 0,
    sellerStatus: seller.status,
  });
}

export async function getSellerDashboardOverview(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    const setup = buildSellerSetupState({
      hasCompleteCollectionProfile: false,
      readyProducts: 0,
      sellerStatus: null,
    });

    return {
      seller: {
        id: "none",
        displayName: "Seller",
        slug: "seller",
        status: "pending",
        isPiessangFulfillmentEnabled: false,
      },
      fulfillmentProfile: null,
      products: { total: 0, active: 0, drafts: 0 },
      orders: { total: 0 },
      shipments: { open: 0, waybillReady: 0 },
      payouts: { total: 0 },
      setup,
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
    [readyProductTotal],
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
        addressLine1: sellerFulfillmentProfiles.addressLine1,
        city: sellerFulfillmentProfiles.city,
        contactEmail: sellerFulfillmentProfiles.contactEmail,
        contactName: sellerFulfillmentProfiles.contactName,
        contactPhone: sellerFulfillmentProfiles.contactPhone,
        id: sellerFulfillmentProfiles.id,
        isVerified: sellerFulfillmentProfiles.isVerified,
        postalCode: sellerFulfillmentProfiles.postalCode,
        province: sellerFulfillmentProfiles.province,
        suburb: sellerFulfillmentProfiles.suburb,
      })
      .from(sellerFulfillmentProfiles)
      .where(eq(sellerFulfillmentProfiles.sellerId, seller.id))
      .limit(1),
    db
      .select({ value: count() })
      .from(products)
      .where(
        and(
          eq(products.sellerId, seller.id),
          inArray(products.status, ["active", "live"]),
        ),
      ),
  ]);
  const setup = buildSellerSetupState({
    hasCompleteCollectionProfile: Boolean(
      fulfillmentProfile?.id &&
        fulfillmentProfile.contactName &&
        fulfillmentProfile.contactPhone &&
        fulfillmentProfile.contactEmail &&
        fulfillmentProfile.addressLine1 &&
        fulfillmentProfile.suburb &&
        fulfillmentProfile.city &&
        fulfillmentProfile.province &&
        fulfillmentProfile.postalCode,
    ),
    readyProducts: readyProductTotal?.value ?? 0,
    sellerStatus: seller.status,
  });

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
    setup,
  };
}

function buildSellerSetupState({
  hasCompleteCollectionProfile,
  readyProducts,
  sellerStatus,
}: {
  hasCompleteCollectionProfile: boolean;
  readyProducts: number;
  sellerStatus: string | null;
}): SellerSetupState {
  const hasSellerProfile = Boolean(sellerStatus);
  const steps: SellerSetupStep[] = [
    {
      actionLabel: null,
      complete: sellerStatus === "active",
      description:
        hasSellerProfile
          ? "This checks the seller profile status, not the user account enabled flag in admin users."
          : "This user is enabled, but no seller profile is linked to this account.",
      href: null,
      id: "seller_profile",
      title: hasSellerProfile ? "Seller profile active" : "Seller profile linked",
    },
    {
      actionLabel: "Set up now",
      complete: hasCompleteCollectionProfile,
      description:
        "Add the contact and collection address couriers use for pickup bookings.",
      href: "/shipping/collection-profile",
      id: "collection_profile",
      title: "Collection profile complete",
    },
    {
      actionLabel: "Create product",
      complete: readyProducts > 0,
      description:
        "Publish or activate at least one product with pricing, media, and parcel data.",
      href: "/products/new",
      id: "products",
      title: "First product ready",
    },
  ];

  const attentionHrefs = steps
    .filter((step): step is SellerSetupStep & { href: string } =>
      Boolean(!step.complete && step.href),
    )
    .map((step) => step.href);

  return {
    attentionHrefs,
    complete: steps.every((step) => step.complete),
    steps,
  };
}
