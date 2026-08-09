import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  courierGuyPackingPlans,
  orderItems,
  orders,
  shipmentParcelItems,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { getBusinessDispatchContact } from "@/src/modules/business-information";
import {
  createCourierGuyClient,
  type CourierGuyRate,
} from "@/src/modules/shipping/courier-guy-client";
import {
  calculateCourierGuyOrderCostProjection,
  centsToMoney,
  createCourierGuyBookingQuoteFingerprint,
  evaluateCourierGuyBookingQuoteSafety,
  findCourierGuyRateForStoredService,
  moneyToCents,
  selectCourierGuyRate,
} from "@/src/modules/shipping/courier-guy-booking-quote-rules";
import { getCourierGuyIntegrationConfig } from "@/src/modules/marketplace/settings";

// Large manual orders can contain many physical packages. Confirmation always
// re-fetches the exact service price, so this window only preserves enough time
// to quote and review the whole set without weakening the final price guard.
const BOOKING_QUOTE_LIFETIME_MS = 30 * 60 * 1000;
const activeShipmentStatuses = [
  "pending_booking",
  "booking",
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "cancelling",
  "collected",
  "in_transit",
  "out_for_delivery",
] as const;

const bookingQuotePayloadSchema = z
  .object({
    accountCode: z.string().trim().min(1),
    amountExcludingVat: z.number().finite().nonnegative().nullable(),
    environment: z.enum(["live", "sandbox"]),
    estimatedDeliveryFrom: z.string().nullable(),
    estimatedDeliveryTo: z.string().nullable(),
    purpose: z.literal("admin_booking"),
    serviceCode: z.string().trim().min(1),
    serviceDescription: z.string().nullable(),
    serviceLevelId: z.string().nullable(),
    shipmentId: z.string().uuid(),
  })
  .passthrough();

export type CourierGuyBookingQuoteView = {
  allowed: boolean;
  currency: "ZAR";
  customerShippingAmount: number;
  deliveryMarginRemaining: number;
  destination: string;
  estimatedDeliveryFrom: string | null;
  estimatedDeliveryTo: string | null;
  expiresAt: string;
  maxAbsorbedAmount: number | null;
  maxBookingCostAmount: number | null;
  orderNumber: string;
  otherProviderCosts: number;
  parcel: {
    heightMm: number;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  };
  projectedAbsorbedAmount: number;
  projectedProviderSpend: number;
  providerAmount: number;
  quoteId: string;
  safetyReason:
    | "booking_cost_limit_exceeded"
    | "absorbed_cost_limit_exceeded"
    | null;
  serviceCode: string;
  serviceDescription: string | null;
  serviceName: string;
  shipmentId: string;
  unquotedOtherCourierShipments: number;
};

type CourierGuyBookingContext = Awaited<
  ReturnType<typeof getCourierGuyBookingContext>
>;

function buildFingerprintSnapshot(
  context: Omit<CourierGuyBookingContext, "client">,
  service: { serviceCode: string; serviceLevelId: string | null },
) {
  return {
    accountCode: context.config.accountCode,
    collectionContact: context.collectionContact,
    collectionOrigin: context.collectionOrigin,
    customerContact: context.deliveryContact,
    deliveryAddress: context.deliveryAddress,
    environment: context.config.mode,
    orderId: context.record.orderId,
    packingPlanRevision: context.packingPlan.revision,
    parcel: {
      assignedItems: [...context.assignedItems]
        .sort((first, second) =>
          first.orderItemId.localeCompare(second.orderItemId),
        )
        .map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
      heightMm: context.parcel.heightMm,
      id: context.parcel.id,
      lengthMm: context.parcel.lengthMm,
      reference: context.parcel.reference,
      weightGrams: context.parcel.weightGrams,
      widthMm: context.parcel.widthMm,
    },
    service,
    shipmentId: context.record.id,
  };
}

async function getCourierGuyBookingContext(shipmentId: string) {
  const [record] = await db
    .select({
      bookingQuoteId: shipments.bookingQuoteId,
      currency: orders.currency,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddress: orders.deliveryAddressSnapshot,
      id: shipments.id,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      packageSequence: shipments.packageSequence,
      packingPlanRevision: shipments.packingPlanRevision,
      provider: shipments.provider,
      sellerId: shipments.sellerId,
      shippingTotal: orders.shippingTotal,
      status: shipments.status,
      updatedAt: shipments.updatedAt,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.id, shipmentId))
    .limit(1);

  if (!record) {
    throw new Error("Shipment could not be found.");
  }

  if (record.provider !== "courier_guy") {
    throw new Error("Only Courier Guy shipments can use provider quotes.");
  }

  if (record.status !== "pending_booking") {
    throw new Error("Only pending Courier Guy shipments can be quoted.");
  }

  const [parcels, packingPlan, config, dispatchContact] = await Promise.all([
    db
      .select()
      .from(shipmentParcels)
      .where(eq(shipmentParcels.shipmentId, shipmentId)),
    db
      .select()
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, record.orderId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getCourierGuyIntegrationConfig(),
    getBusinessDispatchContact(),
  ]);

  if (!config.isConfigured || !config.accountCode || !config.apiKey) {
    throw new Error("The active Courier Guy environment is not fully configured.");
  }

  if (!dispatchContact) {
    throw new Error(
      "Complete the Jurgens Energy dispatch contact name and phone number before quoting.",
    );
  }

  if (
    !packingPlan ||
    record.packingPlanRevision === null ||
    record.packingPlanRevision !== packingPlan.revision ||
    !["confirmed", "booking"].includes(packingPlan.status)
  ) {
    throw new Error(
      "Confirm the complete manual packing plan before requesting Courier Guy quotes.",
    );
  }

  if (parcels.length !== 1) {
    throw new Error(
      `Exactly one packed parcel is required before quoting; this shipment currently has ${parcels.length}.`,
    );
  }

  if (!config.dropoffPickupPointId) {
    throw new Error("Configure a Courier Guy drop-off pickup point.");
  }

  const parcel = parcels[0]!;
  const assignedItems = await db
    .select({
      orderId: orderItems.orderId,
      orderItemId: orderItems.id,
      quantity: shipmentParcelItems.quantity,
      sku: orderItems.skuSnapshot,
      title: orderItems.title,
    })
    .from(shipmentParcelItems)
    .innerJoin(orderItems, eq(orderItems.id, shipmentParcelItems.orderItemId))
    .where(eq(shipmentParcelItems.parcelId, parcel.id));

  if (
    assignedItems.length === 0 ||
    assignedItems.some((item) => item.orderId !== record.orderId)
  ) {
    throw new Error(
      "This package does not have a valid manual order-item allocation.",
    );
  }

  const itemCount = assignedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const manifest = assignedItems
    .map((item) => `${item.sku?.trim() || item.title} x${item.quantity}`)
    .join(", ");
  const packageLabel = record.packageSequence
    ? `package ${record.packageSequence}`
    : "package";
  const courierParcel = {
    description: `Order ${record.orderNumber} ${packageLabel}: ${manifest}`.slice(
      0,
      255,
    ),
    heightMm: Number(parcel.heightMm),
    itemCount,
    lengthMm: Number(parcel.lengthMm),
    weightGrams: Number(parcel.weightGrams),
    widthMm: Number(parcel.widthMm),
  };
  const collectionOrigin = {
    kind: "pickup_point" as const,
    pickupPointId: config.dropoffPickupPointId,
    provider: config.dropoffProvider,
  };
  const deliveryAddress = {
    addressType: "residential" as const,
    city: record.deliveryAddress.city,
    company: undefined,
    countryCode: "ZA",
    localArea:
      record.deliveryAddress.suburb?.trim() || record.deliveryAddress.city,
    postalCode: record.deliveryAddress.postalCode,
    streetAddress: [
      record.deliveryAddress.addressLine1,
      record.deliveryAddress.addressLine2,
    ]
      .filter(Boolean)
      .join(", "),
    zone: record.deliveryAddress.province,
  };
  const collectionContact = {
    mobileNumber: dispatchContact.contactPhone,
    name: dispatchContact.contactName,
  };
  const deliveryContact = {
    email: record.customerEmail,
    mobileNumber: record.customerPhone,
    name: record.customerName,
  };

  return {
    client: createCourierGuyClient({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
    }),
    assignedItems,
    collectionContact,
    collectionOrigin,
    config,
    courierParcel,
    deliveryAddress,
    deliveryContact,
    parcel,
    packingPlan,
    record,
  };
}

async function getOtherOrderProviderCosts({
  orderId,
  shipmentId,
}: {
  orderId: string;
  shipmentId: string;
}) {
  const rows = await db
    .select({
      id: shipments.id,
      provider: shipments.provider,
      providerCostAmount: shipments.providerCostAmount,
      status: shipments.status,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.orderId, orderId),
        ne(shipments.id, shipmentId),
      ),
    );

  return {
    otherProviderCosts: rows.reduce(
      (total, row) => total + Number(row.providerCostAmount ?? 0),
      0,
    ),
    unquotedOtherCourierShipments: rows.filter(
      (row) =>
        row.provider === "courier_guy" &&
        row.providerCostAmount === null &&
        activeShipmentStatuses.includes(
          row.status as (typeof activeShipmentStatuses)[number],
        ),
    ).length,
  };
}

function quoteViewFromRate({
  context,
  expiresAt,
  otherProviderCosts,
  quoteId,
  rate,
  unquotedOtherCourierShipments,
}: {
  context: CourierGuyBookingContext;
  expiresAt: Date;
  otherProviderCosts: number;
  quoteId: string;
  rate: CourierGuyRate;
  unquotedOtherCourierShipments: number;
}): CourierGuyBookingQuoteView {
  const customerShippingAmount = Number(context.record.shippingTotal);
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount,
    otherProviderCosts,
    selectedProviderAmount: rate.providerAmount,
  });
  const maxBookingCostAmount = context.config.maxBookingCostAmount;
  const maxAbsorbedAmount = context.config.maxAbsorbedAmount;
  const safety = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: rate.providerAmount,
    customerShippingAmount,
    freshProviderAmount: rate.providerAmount,
    maxAbsorbedAmount,
    maxBookingCostAmount,
    otherProviderCosts,
  });

  return {
    allowed: safety.allowed,
    currency: "ZAR",
    customerShippingAmount,
    deliveryMarginRemaining: centsToMoney(
      projection.deliveryMarginRemainingCents,
    ),
    destination: [
      context.record.deliveryAddress.suburb,
      context.record.deliveryAddress.city,
      context.record.deliveryAddress.postalCode,
    ]
      .filter(Boolean)
      .join(", "),
    estimatedDeliveryFrom: rate.estimatedDeliveryFrom,
    estimatedDeliveryTo: rate.estimatedDeliveryTo,
    expiresAt: expiresAt.toISOString(),
    maxAbsorbedAmount,
    maxBookingCostAmount,
    orderNumber: context.record.orderNumber,
    otherProviderCosts,
    parcel: {
      heightMm: context.courierParcel.heightMm,
      lengthMm: context.courierParcel.lengthMm,
      weightGrams: context.courierParcel.weightGrams,
      widthMm: context.courierParcel.widthMm,
    },
    projectedAbsorbedAmount: centsToMoney(
      projection.projectedAbsorbedAmountCents,
    ),
    projectedProviderSpend: centsToMoney(
      projection.projectedProviderSpendCents,
    ),
    providerAmount: rate.providerAmount,
    quoteId,
    safetyReason:
      safety.reason === "booking_cost_limit_exceeded" ||
      safety.reason === "absorbed_cost_limit_exceeded"
        ? safety.reason
        : null,
    serviceCode: rate.serviceCode,
    serviceDescription: rate.serviceDescription,
    serviceName: rate.serviceName,
    shipmentId: context.record.id,
    unquotedOtherCourierShipments,
  };
}

export async function createCourierGuyBookingQuote(shipmentId: string) {
  const context = await getCourierGuyBookingContext(shipmentId);
  const [rateResult, costContext] = await Promise.all([
    context.client.getRates({
      collectionOrigin: context.collectionOrigin,
      deliveryAddress: context.deliveryAddress,
      parcels: [context.courierParcel],
    }),
    getOtherOrderProviderCosts({
      orderId: context.record.orderId,
      shipmentId,
    }),
  ]);
  const selectedRate = selectCourierGuyRate(
    rateResult.rates,
    context.config.defaultServiceCode,
  );

  if (!selectedRate) {
    throw new Error(
      context.config.defaultServiceCode
        ? `Courier Guy service ${context.config.defaultServiceCode} is unavailable for this parcel.`
        : "Courier Guy returned no service for this parcel.",
    );
  }

  const fingerprint = createCourierGuyBookingQuoteFingerprint(
    buildFingerprintSnapshot(context, selectedRate),
  );
  const expiresAt = new Date(Date.now() + BOOKING_QUOTE_LIFETIME_MS);
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount: Number(context.record.shippingTotal),
    otherProviderCosts: costContext.otherProviderCosts,
    selectedProviderAmount: selectedRate.providerAmount,
  });
  const marginAmount = centsToMoney(
    Math.abs(
      projection.customerShippingAmountCents -
        projection.projectedProviderSpendCents,
    ),
  );

  const quote = await db.transaction(async (tx) => {
    const [currentShipment] = await tx
      .select({
        bookingQuoteId: shipments.bookingQuoteId,
        status: shipments.status,
        updatedAt: shipments.updatedAt,
      })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");

    if (
      !currentShipment ||
      currentShipment.status !== "pending_booking" ||
      currentShipment.bookingQuoteId !== context.record.bookingQuoteId ||
      currentShipment.updatedAt.getTime() !== context.record.updatedAt.getTime()
    ) {
      throw new Error(
        "The shipment changed while Courier Guy was preparing the quote. Refresh and request a fresh quote.",
      );
    }

    const currentParcels = await tx
      .select()
      .from(shipmentParcels)
      .where(eq(shipmentParcels.shipmentId, shipmentId));
    const currentParcel = currentParcels[0];

    if (
      currentParcels.length !== 1 ||
      !currentParcel ||
      currentParcel.id !== context.parcel.id ||
      currentParcel.reference !== context.parcel.reference ||
      Number(currentParcel.heightMm) !== Number(context.parcel.heightMm) ||
      Number(currentParcel.lengthMm) !== Number(context.parcel.lengthMm) ||
      Number(currentParcel.weightGrams) !== Number(context.parcel.weightGrams) ||
      Number(currentParcel.widthMm) !== Number(context.parcel.widthMm)
    ) {
      throw new Error(
        "The packed parcel changed while Courier Guy was preparing the quote. Refresh and request a fresh quote.",
      );
    }

    if (currentShipment.bookingQuoteId) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "expired" })
        .where(
          and(
            eq(shippingRateQuotes.id, currentShipment.bookingQuoteId),
            eq(shippingRateQuotes.status, "quoted"),
          ),
        );
    }

    const [createdQuote] = await tx
      .insert(shippingRateQuotes)
      .values({
        bufferBps: 0,
        checkoutFingerprint: fingerprint,
        collectionAddressSnapshot: context.collectionOrigin,
        currency: "ZAR",
        customerAmount: Number(context.record.shippingTotal).toFixed(2),
        deliveryAddressSnapshot: context.deliveryAddress,
        expiresAt,
        marginAmount: (
          projection.projectedProviderSpendCents >
          projection.customerShippingAmountCents
            ? -marginAmount
            : marginAmount
        ).toFixed(2),
        marginBps: 0,
        orderId: context.record.orderId,
        parcelSnapshot: [
          {
            ...context.courierParcel,
            parcelId: context.parcel.id,
            reference: context.parcel.reference,
          },
        ],
        provider: "courier_guy",
        providerAmount: selectedRate.providerAmount.toFixed(2),
        providerPayload: {
          accountCode: context.config.accountCode,
          amountExcludingVat: selectedRate.providerAmountExcludingVat,
          environment: context.config.mode,
          estimatedDeliveryFrom: selectedRate.estimatedDeliveryFrom,
          estimatedDeliveryTo: selectedRate.estimatedDeliveryTo,
          purpose: "admin_booking",
          serviceCode: selectedRate.serviceCode,
          serviceDescription: selectedRate.serviceDescription,
          serviceLevelId: selectedRate.serviceLevelId,
          shipmentId,
        },
        providerRateId:
          selectedRate.serviceLevelId ?? selectedRate.serviceCode,
        sellerId: context.record.sellerId,
        serviceLevel: selectedRate.serviceCode,
        serviceName: selectedRate.serviceName,
        status: "quoted",
      })
      .returning({ id: shippingRateQuotes.id });

    const [attached] = await tx
      .update(shipments)
      .set({ bookingQuoteId: createdQuote.id, updatedAt: new Date() })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.status, "pending_booking"),
        ),
      )
      .returning({ id: shipments.id });

    if (!attached) {
      throw new Error(
        "The shipment changed while the provider quote was being saved. Refresh and try again.",
      );
    }

    return createdQuote;
  });

  return quoteViewFromRate({
    context,
    expiresAt,
    otherProviderCosts: costContext.otherProviderCosts,
    quoteId: quote.id,
    rate: selectedRate,
    unquotedOtherCourierShipments:
      costContext.unquotedOtherCourierShipments,
  });
}

export async function prepareCourierGuyQuotedBooking(
  shipmentId: string,
  expectedQuoteId: string,
) {
  const quoteId = z.string().uuid().safeParse(expectedQuoteId);

  if (!quoteId.success) {
    throw new Error("This booking quote is invalid. Get a fresh quote.");
  }

  const context = await getCourierGuyBookingContext(shipmentId);

  if (!context.record.bookingQuoteId) {
    throw new Error("Get a Courier Guy quote before booking this shipment.");
  }

  if (context.record.bookingQuoteId !== quoteId.data) {
    throw new Error(
      "A newer Courier Guy quote replaced the one being confirmed. Review the latest quote before booking.",
    );
  }

  const [quote] = await db
    .select()
    .from(shippingRateQuotes)
    .where(eq(shippingRateQuotes.id, quoteId.data))
    .limit(1);
  const payload = bookingQuotePayloadSchema.safeParse(quote?.providerPayload);

  if (
    !quote ||
    quote.provider !== "courier_guy" ||
    quote.status !== "quoted" ||
    quote.orderId !== context.record.orderId ||
    quote.sellerId !== context.record.sellerId ||
    !payload.success ||
    payload.data.shipmentId !== shipmentId
  ) {
    throw new Error("This booking quote is invalid. Get a fresh quote.");
  }

  if (quote.expiresAt.getTime() <= Date.now()) {
    await expireCourierGuyBookingQuote(shipmentId, quote.id);
    throw new Error("This Courier Guy quote expired. Get a fresh quote.");
  }

  const fingerprint = createCourierGuyBookingQuoteFingerprint(
    buildFingerprintSnapshot(context, {
      serviceCode: payload.data.serviceCode,
      serviceLevelId: payload.data.serviceLevelId,
    }),
  );

  if (fingerprint !== quote.checkoutFingerprint) {
    await expireCourierGuyBookingQuote(shipmentId, quote.id);
    throw new Error(
      "The parcel, address, contact, or Courier Guy setup changed. Get a fresh quote.",
    );
  }

  const [rateResult, costContext] = await Promise.all([
    context.client.getRates({
      collectionOrigin: context.collectionOrigin,
      deliveryAddress: context.deliveryAddress,
      parcels: [context.courierParcel],
    }),
    getOtherOrderProviderCosts({
      orderId: context.record.orderId,
      shipmentId,
    }),
  ]);
  const freshRate = findCourierGuyRateForStoredService(rateResult.rates, {
    serviceCode: payload.data.serviceCode,
    serviceLevelId: payload.data.serviceLevelId,
  });

  if (!freshRate) {
    await expireCourierGuyBookingQuote(shipmentId, quote.id);
    throw new Error(
      `Courier Guy service ${payload.data.serviceCode} is no longer available. Get a fresh quote.`,
    );
  }

  const safety = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: Number(quote.providerAmount),
    customerShippingAmount: Number(context.record.shippingTotal),
    freshProviderAmount: freshRate.providerAmount,
    maxAbsorbedAmount: context.config.maxAbsorbedAmount,
    maxBookingCostAmount: context.config.maxBookingCostAmount,
    otherProviderCosts: costContext.otherProviderCosts,
  });

  if (!safety.allowed) {
    if (safety.reason === "approved_quote_exceeded") {
      await expireCourierGuyBookingQuote(shipmentId, quote.id);
      throw new Error(
        `The Courier Guy price increased from R ${Number(quote.providerAmount).toFixed(2)} to R ${freshRate.providerAmount.toFixed(2)}. Review a fresh quote before booking.`,
      );
    }

    if (safety.reason === "booking_cost_limit_exceeded") {
      throw new Error(
        `The fresh Courier Guy rate exceeds the R ${context.config.maxBookingCostAmount?.toFixed(2)} per-shipment safety limit.`,
      );
    }

    throw new Error(
      `This booking would make Jurgens absorb R ${centsToMoney(safety.projectedAbsorbedAmountCents).toFixed(2)}, above the configured R ${context.config.maxAbsorbedAmount?.toFixed(2)} limit.`,
    );
  }

  return {
    context,
    costContext,
    freshRate,
    payload: payload.data,
    quote,
    safety,
  };
}

export async function expireCourierGuyBookingQuote(
  shipmentId: string,
  quoteId?: string,
) {
  await db.transaction(async (tx) => {
    const [shipment] = await tx
      .select({ bookingQuoteId: shipments.bookingQuoteId })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");
    const attachedQuoteId = quoteId ?? shipment?.bookingQuoteId;

    if (attachedQuoteId) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "expired" })
        .where(
          and(
            eq(shippingRateQuotes.id, attachedQuoteId),
            eq(shippingRateQuotes.status, "quoted"),
          ),
        );
    }

    await tx
      .update(shipments)
      .set({ bookingQuoteId: null, updatedAt: new Date() })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.status, "pending_booking"),
          attachedQuoteId
            ? eq(shipments.bookingQuoteId, attachedQuoteId)
            : sql`${shipments.bookingQuoteId} IS NULL`,
        ),
      );
  });
}

export function resolveCourierGuySelectedService(rate: CourierGuyRate) {
  return rate.serviceLevelId && /^\d+$/.test(rate.serviceLevelId)
    ? { serviceLevelId: Number(rate.serviceLevelId) }
    : rate.serviceLevelId
      ? { serviceLevelId: rate.serviceLevelId }
      : { serviceLevelCode: rate.serviceCode };
}

export function actualCostExceededApprovedQuote({
  actualProviderAmount,
  approvedProviderAmount,
}: {
  actualProviderAmount: number;
  approvedProviderAmount: number;
}) {
  return moneyToCents(actualProviderAmount) > moneyToCents(approvedProviderAmount);
}
