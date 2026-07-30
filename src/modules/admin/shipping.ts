import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  courierGuyWebhookEvents,
  orders,
  shipmentEvents,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { createCourierGuyBookingReference } from "@/src/modules/shipping/courier-guy-operations";

export type AdminShipmentRow = {
  bookingReference: string;
  bookedAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  id: string;
  orderId: string;
  orderNumber: string;
  parcelCount: number;
  provider: string;
  providerAccountCode: string | null;
  providerCostAmount: string | null;
  providerCostCurrency: string | null;
  providerEnvironment: "live" | "sandbox" | null;
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

export type AdminCourierGuyWebhookRow = {
  providerEnvironment: "live" | "sandbox";
  providerEventId: string;
  providerShipmentId: string | null;
  receivedAt: Date;
  status: string;
  topic: string;
};

export type AdminShippingData = {
  courierGuy: {
    defaultServiceCode: string | null;
    dropoffPickupPointId: string | null;
    dropoffType: string;
    enabled: boolean;
    hasActiveAccountCode: boolean;
    hasActiveApiKey: boolean;
    hasWebhookToken: boolean;
    mode: "live" | "sandbox";
    shippingEnabled: boolean;
  };
  metrics: {
    courierGuyShipments: number;
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
  webhookEvents: AdminCourierGuyWebhookRow[];
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
        orderNumber: orders.orderNumber,
        provider: shipments.provider,
        providerAccountCode: shipments.providerAccountCode,
        providerCostAmount: shipments.providerCostAmount,
        providerCostCurrency: shipments.providerCostCurrency,
        providerEnvironment: shipments.providerEnvironment,
        providerShipmentId: shipments.providerShipmentId,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        updatedAt: shipments.updatedAt,
        waybillNumber: shipments.waybillNumber,
        waybillUrl: shipments.waybillUrl,
      })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
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
        providerEnvironment: courierGuyWebhookEvents.providerEnvironment,
        providerEventId: courierGuyWebhookEvents.providerEventId,
        providerShipmentId: courierGuyWebhookEvents.providerShipmentId,
        receivedAt: courierGuyWebhookEvents.receivedAt,
        status: courierGuyWebhookEvents.status,
        topic: courierGuyWebhookEvents.topic,
      })
      .from(courierGuyWebhookEvents)
      .orderBy(desc(courierGuyWebhookEvents.receivedAt))
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
    bookingReference: createCourierGuyBookingReference(
      shipment.orderNumber,
      shipment.id,
    ),
    parcelCount: parcelCountByShipmentId.get(shipment.id) ?? 0,
  }));

  return {
    courierGuy: {
      defaultServiceCode: settings.courierGuyDefaultServiceCode,
      dropoffPickupPointId: settings.courierGuyDropoffPickupPointId,
      dropoffType: settings.courierGuyDropoffType,
      enabled: settings.courierGuyEnabled,
      hasActiveAccountCode: Boolean(
        settings.courierGuyMode === "live"
          ? settings.courierGuyLiveAccountCode
          : settings.courierGuySandboxAccountCode,
      ),
      hasActiveApiKey:
        settings.courierGuyMode === "live"
          ? settings.hasCourierGuyLiveApiKey
          : settings.hasCourierGuySandboxApiKey,
      hasWebhookToken: settings.hasCourierGuyWebhookToken,
      mode: settings.courierGuyMode,
      shippingEnabled: settings.shippingEnabled,
    },
    metrics: {
      courierGuyShipments: shipmentData.filter(
        (shipment) => shipment.provider === "courier_guy",
      ).length,
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
