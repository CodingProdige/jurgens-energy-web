import {
  boolean,
  integer,
  index,
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

export const jurgensDeliveryScheduleStatuses = [
  "scheduled",
  "preparing",
  "out_for_delivery",
  "completed",
  "missed",
  "rescheduled",
  "cancelled",
] as const;

export type JurgensDeliveryScheduleStatus =
  (typeof jurgensDeliveryScheduleStatuses)[number];

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

export const sellerParcelPresets = pgTable(
  "seller_parcel_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 140 }).notNull(),
    weightGrams: numeric("weight_grams", {
      mode: "number",
      precision: 12,
      scale: 3,
    }).notNull(),
    lengthMm: numeric("length_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }).notNull(),
    widthMm: numeric("width_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }).notNull(),
    heightMm: numeric("height_mm", {
      mode: "number",
      precision: 12,
      scale: 3,
    }).notNull(),
    notes: text("notes"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (preset) => ({
    sellerIdx: index("seller_parcel_presets_seller_id_idx").on(preset.sellerId),
    sellerNameUnique: unique("seller_parcel_presets_seller_name_unique").on(
      preset.sellerId,
      preset.normalizedName,
    ),
  }),
);

export const jurgensDeliveryZones = pgTable(
  "jurgens_delivery_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    postalCodes: jsonb("postal_codes").$type<string[]>().notNull().default([]),
    minimumOrderAmount: numeric("minimum_order_amount", {
      mode: "number",
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default(0),
    deliveryInformation: text("delivery_information"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (zone) => ({
    activeIdx: index("jurgens_delivery_zones_active_idx").on(zone.isActive),
    sortIdx: index("jurgens_delivery_zones_sort_idx").on(zone.sortOrder),
  }),
);

export const jurgensDeliveryZoneRates = pgTable(
  "jurgens_delivery_zone_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => jurgensDeliveryZones.id, { onDelete: "cascade" }),
    fromAmount: numeric("from_amount", {
      mode: "number",
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default(0),
    upToAmount: numeric("up_to_amount", {
      mode: "number",
      precision: 12,
      scale: 2,
    }),
    price: numeric("price", {
      mode: "number",
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (rate) => ({
    zoneIdx: index("jurgens_delivery_zone_rates_zone_id_idx").on(rate.zoneId),
    zoneSortIdx: index("jurgens_delivery_zone_rates_zone_sort_idx").on(
      rate.zoneId,
      rate.sortOrder,
    ),
  }),
);

export const shippingRateQuotes = pgTable("shipping_rate_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  sellerId: uuid("seller_id").references(() => sellers.id, {
    onDelete: "set null",
  }),
  provider: shippingProvider("provider").notNull(),
  status: shippingQuoteStatus("status").notNull().default("quoted"),
  checkoutFingerprint: varchar("checkout_fingerprint", { length: 64 }),
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
  sellerId: uuid("seller_id").references(() => sellers.id, {
    onDelete: "set null",
  }),
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
  weightGrams: numeric("weight_grams", {
    mode: "number",
    precision: 12,
    scale: 3,
  }).notNull(),
  lengthMm: numeric("length_mm", {
    mode: "number",
    precision: 12,
    scale: 3,
  }).notNull(),
  widthMm: numeric("width_mm", {
    mode: "number",
    precision: 12,
    scale: 3,
  }).notNull(),
  heightMm: numeric("height_mm", {
    mode: "number",
    precision: 12,
    scale: 3,
  }).notNull(),
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

export const jurgensDeliverySchedules = pgTable(
  "jurgens_delivery_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    quoteId: uuid("quote_id").references(() => shippingRateQuotes.id, {
      onDelete: "set null",
    }),
    zoneId: uuid("zone_id").references(() => jurgensDeliveryZones.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 })
      .$type<JurgensDeliveryScheduleStatus>()
      .notNull()
      .default("scheduled"),
    scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
    windowStart: varchar("window_start", { length: 5 }),
    windowEnd: varchar("window_end", { length: 5 }),
    windowLabel: varchar("window_label", { length: 80 }),
    deliveryInstructions: text("delivery_instructions"),
    lastNotifiedStatus: varchar("last_notified_status", { length: 32 }),
    lastNotifiedAt: timestamp("last_notified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (schedule) => ({
    dateStatusIdx: index("jurgens_delivery_schedules_date_status_idx").on(
      schedule.scheduledDate,
      schedule.status,
    ),
    orderIdx: index("jurgens_delivery_schedules_order_id_idx").on(
      schedule.orderId,
    ),
    shipmentIdx: index("jurgens_delivery_schedules_shipment_id_idx").on(
      schedule.shipmentId,
    ),
  }),
);

export const bobgoWebhookEvents = pgTable(
  "bobgo_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topic: varchar("topic", { length: 160 }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerShipmentId: text("provider_shipment_id"),
    status: varchar("status", { length: 32 }).notNull().default("received"),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date" }),
  },
  (event) => ({
    providerEventUnique: unique("bobgo_webhook_events_provider_event_unique").on(
      event.providerEventId,
    ),
    shipmentIdx: index("bobgo_webhook_events_provider_shipment_id_idx").on(
      event.providerShipmentId,
    ),
    topicIdx: index("bobgo_webhook_events_topic_idx").on(event.topic),
  }),
);
