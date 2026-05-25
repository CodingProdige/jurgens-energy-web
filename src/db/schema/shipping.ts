import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { orders } from "@/src/db/schema/orders";
import { sellers } from "@/src/db/schema/sellers";

export const shippingProvider = pgEnum("shipping_provider", [
  "manual",
  "bobgo",
  "piessang_local",
]);

export const shippingQuoteStatus = pgEnum("shipping_quote_status", [
  "quoted",
  "selected",
  "expired",
  "booked",
  "cancelled",
]);

export const shipmentStatus = pgEnum("shipment_status", [
  "pending_booking",
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "returned",
  "cancelled",
]);

export const sellerFulfillmentProfiles = pgTable(
  "seller_fulfillment_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    contactName: varchar("contact_name", { length: 160 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 40 }).notNull(),
    contactEmail: varchar("contact_email", { length: 254 }).notNull(),
    addressType: varchar("address_type", { length: 32 })
      .notNull()
      .default("business"),
    addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 240 }),
    suburb: varchar("suburb", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    province: varchar("province", { length: 120 }).notNull(),
    postalCode: varchar("postal_code", { length: 40 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("ZA"),
    collectionInstructions: text("collection_instructions"),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (profile) => ({
    sellerUnique: unique("seller_fulfillment_profiles_seller_id_unique").on(
      profile.sellerId,
    ),
  }),
);

export const shippingRateQuotes = pgTable("shipping_rate_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellers.id),
  provider: shippingProvider("provider").notNull(),
  status: shippingQuoteStatus("status").notNull().default("quoted"),
  providerRateId: text("provider_rate_id"),
  serviceName: varchar("service_name", { length: 160 }).notNull(),
  serviceLevel: varchar("service_level", { length: 120 }),
  currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
  providerAmount: numeric("provider_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  customerAmount: numeric("customer_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  marginAmount: numeric("margin_amount", { precision: 12, scale: 2 }).notNull(),
  marginBps: integer("margin_bps").notNull().default(0),
  bufferBps: integer("buffer_bps").notNull().default(0),
  collectionAddressSnapshot: jsonb("collection_address_snapshot").notNull(),
  deliveryAddressSnapshot: jsonb("delivery_address_snapshot").notNull(),
  parcelSnapshot: jsonb("parcel_snapshot").notNull(),
  providerPayload: jsonb("provider_payload"),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellers.id),
  quoteId: uuid("quote_id").references(() => shippingRateQuotes.id, {
    onDelete: "set null",
  }),
  provider: shippingProvider("provider").notNull(),
  status: shipmentStatus("status").notNull().default("pending_booking"),
  providerShipmentId: text("provider_shipment_id"),
  waybillNumber: varchar("waybill_number", { length: 160 }),
  trackingNumber: varchar("tracking_number", { length: 160 }),
  trackingUrl: text("tracking_url"),
  waybillUrl: text("waybill_url"),
  bookedAt: timestamp("booked_at", { mode: "date" }),
  collectedAt: timestamp("collected_at", { mode: "date" }),
  deliveredAt: timestamp("delivered_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const shipmentParcels = pgTable("shipment_parcels", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  weightGrams: integer("weight_grams").notNull(),
  lengthMm: integer("length_mm").notNull(),
  widthMm: integer("width_mm").notNull(),
  heightMm: integer("height_mm").notNull(),
  declaredValue: numeric("declared_value", { precision: 12, scale: 2 }),
  reference: varchar("reference", { length: 160 }),
});

export const shipmentEvents = pgTable("shipment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  provider: shippingProvider("provider").notNull(),
  providerEventId: text("provider_event_id"),
  status: varchar("status", { length: 120 }).notNull(),
  message: text("message"),
  location: varchar("location", { length: 180 }),
  occurredAt: timestamp("occurred_at", { mode: "date" }).notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
