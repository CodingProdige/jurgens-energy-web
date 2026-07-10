import { desc, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  bobgoWebhookEvents,
  shipmentEvents,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

export type AdminShipmentRow = {
  bookedAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  id: string;
  orderId: string;
  parcelCount: number;
  provider: string;
  providerShipmentId: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: Date;
  waybillNumber: string | null;
  waybillUrl: string | null;
};

export type AdminShippingQuoteRow = {
  createdAt: Date;
  customerAmount: string;
  expiresAt: Date;
  id: string;
  orderId: string | null;
  provider: string;
  providerAmount: string;
  serviceName: string;
  status: string;
};

export type AdminBobGoWebhookRow = {
  providerEventId: string;
  providerShipmentId: string | null;
  receivedAt: Date;
  status: string;
  topic: string;
};

export type AdminShippingData = {
  bobgo: {
    bookingMode: "disabled" | "quote_only" | "quote_and_book";
    enabled: boolean;
    hasActiveApiKey: boolean;
    hasActiveWebhookSecret: boolean;
    mode: "live" | "sandbox";
    shippingEnabled: boolean;
  };
  metrics: {
    bobgoQuotes: number;
    booked: number;
    delivered: number;
    inTransit: number;
    pendingBooking: number;
    readyForCollection: number;
    shipments: number;
    webhookEvents: number;
  };
  quotes: AdminShippingQuoteRow[];
  shipments: AdminShipmentRow[];
  webhookEvents: AdminBobGoWebhookRow[];
};

export async function getAdminShippingData(): Promise<AdminShippingData> {
  const [settings, shipmentRows, quoteRows, webhookRows] = await Promise.all([
    getMarketplaceSettings(),
    db
      .select({
        bookedAt: shipments.bookedAt,
        createdAt: shipments.createdAt,
        deliveredAt: shipments.deliveredAt,
        id: shipments.id,
        orderId: shipments.orderId,
        provider: shipments.provider,
        providerShipmentId: shipments.providerShipmentId,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        updatedAt: shipments.updatedAt,
        waybillNumber: shipments.waybillNumber,
        waybillUrl: shipments.waybillUrl,
      })
      .from(shipments)
      .orderBy(desc(shipments.updatedAt)),
    db
      .select({
        createdAt: shippingRateQuotes.createdAt,
        customerAmount: shippingRateQuotes.customerAmount,
        expiresAt: shippingRateQuotes.expiresAt,
        id: shippingRateQuotes.id,
        orderId: shippingRateQuotes.orderId,
        provider: shippingRateQuotes.provider,
        providerAmount: shippingRateQuotes.providerAmount,
        serviceName: shippingRateQuotes.serviceName,
        status: shippingRateQuotes.status,
      })
      .from(shippingRateQuotes)
      .orderBy(desc(shippingRateQuotes.createdAt)),
    db
      .select({
        providerEventId: bobgoWebhookEvents.providerEventId,
        providerShipmentId: bobgoWebhookEvents.providerShipmentId,
        receivedAt: bobgoWebhookEvents.receivedAt,
        status: bobgoWebhookEvents.status,
        topic: bobgoWebhookEvents.topic,
      })
      .from(bobgoWebhookEvents)
      .orderBy(desc(bobgoWebhookEvents.receivedAt))
      .limit(12),
  ]);

  const shipmentIds = shipmentRows.map((shipment) => shipment.id);
  const parcelRows =
    shipmentIds.length > 0
      ? await db
          .select({
            shipmentId: shipmentParcels.shipmentId,
          })
          .from(shipmentParcels)
          .where(inArray(shipmentParcels.shipmentId, shipmentIds))
      : [];
  const latestEventRows =
    shipmentIds.length > 0
      ? await db
          .select({
            shipmentId: shipmentEvents.shipmentId,
          })
          .from(shipmentEvents)
          .where(inArray(shipmentEvents.shipmentId, shipmentIds))
      : [];
  const parcelCountByShipmentId = new Map<string, number>();
  const eventCountByShipmentId = new Map<string, number>();

  for (const parcel of parcelRows) {
    parcelCountByShipmentId.set(
      parcel.shipmentId,
      (parcelCountByShipmentId.get(parcel.shipmentId) ?? 0) + 1,
    );
  }

  for (const event of latestEventRows) {
    eventCountByShipmentId.set(
      event.shipmentId,
      (eventCountByShipmentId.get(event.shipmentId) ?? 0) + 1,
    );
  }

  const shipmentData = shipmentRows.map((shipment) => ({
    ...shipment,
    parcelCount: parcelCountByShipmentId.get(shipment.id) ?? 0,
  }));

  return {
    bobgo: {
      bookingMode: settings.bobgoBookingMode,
      enabled: settings.bobgoEnabled,
      hasActiveApiKey:
        settings.bobgoMode === "live"
          ? settings.hasBobgoLiveApiKey
          : settings.hasBobgoSandboxApiKey,
      hasActiveWebhookSecret:
        settings.bobgoMode === "live"
          ? settings.hasBobgoLiveWebhookSecret
          : settings.hasBobgoSandboxWebhookSecret,
      mode: settings.bobgoMode,
      shippingEnabled: settings.shippingEnabled,
    },
    metrics: {
      bobgoQuotes: quoteRows.filter((quote) => quote.provider === "bobgo").length,
      booked: shipmentData.filter((shipment) => shipment.status === "booked")
        .length,
      delivered: shipmentData.filter((shipment) => shipment.status === "delivered")
        .length,
      inTransit: shipmentData.filter((shipment) =>
        ["collected", "in_transit", "out_for_delivery"].includes(shipment.status),
      ).length,
      pendingBooking: shipmentData.filter(
        (shipment) => shipment.status === "pending_booking",
      ).length,
      readyForCollection: shipmentData.filter((shipment) =>
        ["ready_for_collection", "waybill_ready"].includes(shipment.status),
      ).length,
      shipments: shipmentData.length,
      webhookEvents: webhookRows.length + [...eventCountByShipmentId.values()].reduce(
        (total, count) => total + count,
        0,
      ),
    },
    quotes: quoteRows,
    shipments: shipmentData,
    webhookEvents: webhookRows,
  };
}
