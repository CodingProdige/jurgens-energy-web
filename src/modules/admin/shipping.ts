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
  approvedProviderCostAmount: string | null;
  bookingReference: string;
  bookedAt: Date | null;
  createdAt: Date;
  costExceededApprovedQuote: boolean;
  deliveredAt: Date | null;
  id: string;
  orderId: string;
  orderNumber: string;
  parcelCount: number;
  packedParcel: {
    heightMm: number;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  } | null;
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
        bookingQuoteId: shipments.bookingQuoteId,
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
      .where(eq(shippingRateQuotes.provider, "manual"))
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
  const bookingQuoteIds = shipmentRows.flatMap((shipment) =>
    shipment.bookingQuoteId ? [shipment.bookingQuoteId] : [],
  );
  const [parcelRows, latestEventRows, bookingQuoteRows] = await Promise.all([
    shipmentIds.length > 0
      ? db
          .select({
            heightMm: shipmentParcels.heightMm,
            lengthMm: shipmentParcels.lengthMm,
            shipmentId: shipmentParcels.shipmentId,
            weightGrams: shipmentParcels.weightGrams,
            widthMm: shipmentParcels.widthMm,
          })
          .from(shipmentParcels)
          .where(inArray(shipmentParcels.shipmentId, shipmentIds))
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? db
          .select({
            shipmentId: shipmentEvents.shipmentId,
          })
          .from(shipmentEvents)
          .where(inArray(shipmentEvents.shipmentId, shipmentIds))
      : Promise.resolve([]),
    bookingQuoteIds.length > 0
      ? db
          .select({
            id: shippingRateQuotes.id,
            providerAmount: shippingRateQuotes.providerAmount,
          })
          .from(shippingRateQuotes)
          .where(inArray(shippingRateQuotes.id, bookingQuoteIds))
      : Promise.resolve([]),
  ]);
  const parcelCountByShipmentId = new Map<string, number>();
  const parcelRowsByShipmentId = new Map<
    string,
    typeof parcelRows
  >();
  const eventCountByShipmentId = new Map<string, number>();
  const approvedCostByQuoteId = new Map(
    bookingQuoteRows.map((quote) => [quote.id, quote.providerAmount]),
  );

  for (const parcel of parcelRows) {
    parcelCountByShipmentId.set(
      parcel.shipmentId,
      (parcelCountByShipmentId.get(parcel.shipmentId) ?? 0) + 1,
    );
    parcelRowsByShipmentId.set(parcel.shipmentId, [
      ...(parcelRowsByShipmentId.get(parcel.shipmentId) ?? []),
      parcel,
    ]);
  }

  for (const event of latestEventRows) {
    eventCountByShipmentId.set(
      event.shipmentId,
      (eventCountByShipmentId.get(event.shipmentId) ?? 0) + 1,
    );
  }

  const shipmentData = shipmentRows.map((shipment) => {
    const packedParcels = parcelRowsByShipmentId.get(shipment.id) ?? [];
    const packedParcel = packedParcels.length === 1 ? packedParcels[0]! : null;
    const approvedProviderCostAmount = shipment.bookingQuoteId
      ? approvedCostByQuoteId.get(shipment.bookingQuoteId) ?? null
      : null;
    const costExceededApprovedQuote = Boolean(
      shipment.providerCostAmount !== null &&
        approvedProviderCostAmount !== null &&
        Math.round(Number(shipment.providerCostAmount) * 100) >
          Math.round(Number(approvedProviderCostAmount) * 100),
    );

    return {
      ...shipment,
      approvedProviderCostAmount,
      bookingReference: createCourierGuyBookingReference(
        shipment.orderNumber,
        shipment.id,
      ),
      costExceededApprovedQuote,
      packedParcel: packedParcel
        ? {
            heightMm: Number(packedParcel.heightMm),
            lengthMm: Number(packedParcel.lengthMm),
            weightGrams: Number(packedParcel.weightGrams),
            widthMm: Number(packedParcel.widthMm),
          }
        : null,
      parcelCount: parcelCountByShipmentId.get(shipment.id) ?? 0,
    };
  });

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
        (shipment) =>
          shipment.provider === "courier_guy" &&
          shipment.status === "pending_booking",
      ).length,
      readyForCollection: shipmentData.filter((shipment) =>
        shipment.provider === "courier_guy" &&
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
