import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/src/db";
import {
  sellerFulfillmentProfiles,
  sellerParcelPresets,
  shipments,
} from "@/src/db/schema";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerParcelPresetRow = {
  createdAt: Date;
  heightMm: number;
  id: string;
  isDefault: boolean;
  isActive: boolean;
  lengthMm: number;
  name: string;
  notes: string | null;
  updatedAt: Date;
  weightGrams: number;
  widthMm: number;
};

export type SellerShipmentRow = {
  bookedAt: Date | null;
  collectedAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  id: string;
  orderId: string;
  provider: "manual" | "bobgo" | "piessang_local";
  serviceName: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: Date;
  waybillNumber: string | null;
  waybillUrl: string | null;
};

export type SellerCollectionProfile = {
  addressLine1: string;
  addressLine2: string | null;
  addressType: string;
  city: string;
  collectionInstructions: string | null;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  countryCode: string;
  id: string;
  isVerified: boolean;
  postalCode: string;
  province: string;
  suburb: string;
} | null;

export async function getSellerParcelPresets(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return { presets: [], seller: null };
  }

  const presets = await db
    .select({
      createdAt: sellerParcelPresets.createdAt,
      heightMm: sellerParcelPresets.heightMm,
      id: sellerParcelPresets.id,
      isActive: sellerParcelPresets.isActive,
      isDefault: sellerParcelPresets.isDefault,
      lengthMm: sellerParcelPresets.lengthMm,
      name: sellerParcelPresets.name,
      notes: sellerParcelPresets.notes,
      updatedAt: sellerParcelPresets.updatedAt,
      weightGrams: sellerParcelPresets.weightGrams,
      widthMm: sellerParcelPresets.widthMm,
    })
    .from(sellerParcelPresets)
    .where(eq(sellerParcelPresets.sellerId, seller.id))
    .orderBy(desc(sellerParcelPresets.isDefault), asc(sellerParcelPresets.name));

  return { presets, seller };
}

export async function getSellerShipments(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return { shipments: [], seller: null };
  }

  const rows = await db
    .select({
      bookedAt: shipments.bookedAt,
      collectedAt: shipments.collectedAt,
      createdAt: shipments.createdAt,
      deliveredAt: shipments.deliveredAt,
      id: shipments.id,
      orderId: shipments.orderId,
      provider: shipments.provider,
      serviceName: shipments.providerShipmentId,
      status: shipments.status,
      trackingNumber: shipments.trackingNumber,
      trackingUrl: shipments.trackingUrl,
      updatedAt: shipments.updatedAt,
      waybillNumber: shipments.waybillNumber,
      waybillUrl: shipments.waybillUrl,
    })
    .from(shipments)
    .where(eq(shipments.sellerId, seller.id))
    .orderBy(desc(shipments.createdAt));

  return { shipments: rows, seller };
}

export async function getSellerCollectionProfile(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return { profile: null, seller: null };
  }

  const [profile] = await db
    .select({
      addressLine1: sellerFulfillmentProfiles.addressLine1,
      addressLine2: sellerFulfillmentProfiles.addressLine2,
      addressType: sellerFulfillmentProfiles.addressType,
      city: sellerFulfillmentProfiles.city,
      collectionInstructions: sellerFulfillmentProfiles.collectionInstructions,
      contactEmail: sellerFulfillmentProfiles.contactEmail,
      contactName: sellerFulfillmentProfiles.contactName,
      contactPhone: sellerFulfillmentProfiles.contactPhone,
      countryCode: sellerFulfillmentProfiles.countryCode,
      id: sellerFulfillmentProfiles.id,
      isVerified: sellerFulfillmentProfiles.isVerified,
      postalCode: sellerFulfillmentProfiles.postalCode,
      province: sellerFulfillmentProfiles.province,
      suburb: sellerFulfillmentProfiles.suburb,
    })
    .from(sellerFulfillmentProfiles)
    .where(eq(sellerFulfillmentProfiles.sellerId, seller.id))
    .limit(1);

  return { profile: profile ?? null, seller };
}

export async function getSellerShippingOverview(userId: string) {
  const seller = await getPrimarySellerForUser(userId);

  if (!seller) {
    return {
      collections: { completed: 0, upcoming: 0 },
      profile: null,
      seller: null,
      shipments: { open: 0, ready: 0 },
      presets: { active: 0, total: 0 },
    };
  }

  const [[presetTotal], [activePresetTotal], [openShipmentTotal], [readyShipmentTotal], [upcomingCollectionTotal], [completedCollectionTotal], [profile]] =
    await Promise.all([
      db.select({ value: count() }).from(sellerParcelPresets).where(eq(sellerParcelPresets.sellerId, seller.id)),
      db.select({ value: count() }).from(sellerParcelPresets).where(and(eq(sellerParcelPresets.sellerId, seller.id), eq(sellerParcelPresets.isActive, true))),
      db.select({ value: count() }).from(shipments).where(and(eq(shipments.sellerId, seller.id), ne(shipments.status, "delivered"), ne(shipments.status, "cancelled"), ne(shipments.status, "returned"))),
      db.select({ value: count() }).from(shipments).where(and(eq(shipments.sellerId, seller.id), inArray(shipments.status, ["waybill_ready", "ready_for_collection"]))),
      db.select({ value: count() }).from(shipments).where(and(eq(shipments.sellerId, seller.id), inArray(shipments.status, ["booked", "waybill_ready", "ready_for_collection"]))),
      db.select({ value: count() }).from(shipments).where(and(eq(shipments.sellerId, seller.id), inArray(shipments.status, ["collected", "delivered"]))),
      db.select({ id: sellerFulfillmentProfiles.id, isVerified: sellerFulfillmentProfiles.isVerified }).from(sellerFulfillmentProfiles).where(eq(sellerFulfillmentProfiles.sellerId, seller.id)).limit(1),
    ]);

  return {
    collections: {
      completed: completedCollectionTotal?.value ?? 0,
      upcoming: upcomingCollectionTotal?.value ?? 0,
    },
    profile: profile ?? null,
    seller,
    shipments: {
      open: openShipmentTotal?.value ?? 0,
      ready: readyShipmentTotal?.value ?? 0,
    },
    presets: {
      active: activePresetTotal?.value ?? 0,
      total: presetTotal?.value ?? 0,
    },
  };
}
