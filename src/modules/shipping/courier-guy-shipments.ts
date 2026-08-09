import "server-only";

import { and, eq, gt, inArray, ne, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orders,
  paymentRefunds,
  shipmentEvents,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { reconcileOrderFulfillment } from "@/src/modules/orders/fulfillment";
import {
  cancelCourierGuyShipment,
  createCourierGuyClient,
  isCourierGuyRequestDefinitelyRejected,
  type CourierGuyRate,
} from "@/src/modules/shipping/courier-guy-client";
import {
  actualCostExceededApprovedQuote,
  prepareCourierGuyQuotedBooking,
  resolveCourierGuySelectedService,
} from "@/src/modules/shipping/courier-guy-booking-quotes";
import {
  centsToMoney,
  evaluateCourierGuyBookingQuoteSafety,
  selectCourierGuyRate as selectCourierGuyRateRule,
} from "@/src/modules/shipping/courier-guy-booking-quote-rules";
import {
  courierGuyCancellableShipmentStatuses,
  createCourierGuyBookingReference,
  createCourierGuyCustomerTrackingUrl,
  matchesCourierGuyBookingReference,
} from "@/src/modules/shipping/courier-guy-operations";
import { sendCourierGuyShipmentStatusNotification } from "@/src/modules/shipping/courier-guy-notifications";
import { synchronizeCourierGuyBookingBatchAfterReconciliation } from "@/src/modules/shipping/courier-guy-order-booking-state";
import {
  createCourierGuyTrackingEventId,
  resolveCourierGuyMilestones,
  resolveCourierGuyShipmentStatus,
} from "@/src/modules/shipping/courier-guy-tracking";
import { replayUnmatchedCourierGuyWebhookEvents } from "@/src/modules/shipping/courier-guy-webhook-processing";
import { getCourierGuyOperationalConfig } from "@/src/modules/marketplace/settings";

const courierGuyCostReservationStatuses = [
  "booking",
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "cancelling",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "returned",
  "undeliverable",
  "cancelled",
] as const;

export async function bookCourierGuyShipment(
  shipmentId: string,
  expectedQuoteId: string,
) {
  let bookingReference: string | null = null;
  let providerCreationAttempted = false;
  const existingBeforePreparation = await getCourierGuyShipmentRecord(shipmentId);

  if (
    existingBeforePreparation?.provider === "courier_guy" &&
    existingBeforePreparation.providerShipmentId &&
    existingBeforePreparation.trackingNumber
  ) {
    if (existingBeforePreparation.bookingQuoteId !== expectedQuoteId) {
      throw new Error(
        "This request does not match the quote used to book the shipment.",
      );
    }

    await synchronizeCourierGuyShipmentOutcome({
      orderId: existingBeforePreparation.orderId,
      shipmentId,
    });

    return {
      alreadyBooked: true as const,
      providerShipmentId: existingBeforePreparation.providerShipmentId,
      trackingReference: existingBeforePreparation.trackingNumber,
    };
  }

  if (existingBeforePreparation?.status === "booking") {
    throw new Error(
      `This booking has an uncertain outcome. Search The Courier Guy portal for customer reference ${createCourierGuyBookingReference(existingBeforePreparation.orderNumber, shipmentId)} before taking further action.`,
    );
  }

  const prepared = await prepareCourierGuyQuotedBooking(
    shipmentId,
    expectedQuoteId,
  );

  if (prepared.context.packingPlan.status !== "booking") {
    throw new Error(
      "Confirm the complete order-level quote before booking Courier Guy packages.",
    );
  }

  const approvedProviderAmount = Number(prepared.quote.providerAmount);
  const claimed = await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({
        currency: orders.currency,
        id: orders.id,
        shippingTotal: orders.shippingTotal,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, prepared.context.record.orderId))
      .limit(1)
      .for("update");

    if (!lockedOrder) {
      throw new Error("The order could not be found before booking.");
    }

    const [refund] = await tx
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, lockedOrder.id))
      .limit(1);

    if (
      lockedOrder.status !== "paid" ||
      lockedOrder.currency !== "ZAR" ||
      refund
    ) {
      throw new Error(
        refund
          ? "This order has a refund record and cannot be booked with Courier Guy."
          : "Only paid ZAR orders can be booked with Courier Guy.",
      );
    }

    const otherShipments = await tx
      .select({
        bookingQuoteAmount: shippingRateQuotes.providerAmount,
        bookingQuoteStatus: shippingRateQuotes.status,
        provider: shipments.provider,
        providerCostAmount: shipments.providerCostAmount,
        status: shipments.status,
      })
      .from(shipments)
      .leftJoin(
        shippingRateQuotes,
        eq(shippingRateQuotes.id, shipments.bookingQuoteId),
      )
      .where(
        and(
          eq(shipments.orderId, prepared.context.record.orderId),
          ne(shipments.id, shipmentId),
        ),
      );
    let unresolvedCommittedCourierShipments = 0;
    const otherProviderCosts = otherShipments.reduce((total, shipment) => {
      if (shipment.providerCostAmount !== null) {
        const providerCostAmount = Number(shipment.providerCostAmount);

        if (!Number.isFinite(providerCostAmount) || providerCostAmount < 0) {
          throw new Error(
            "A stored carrier cost is invalid. Correct it before booking another shipment for this order.",
          );
        }

        return total + providerCostAmount;
      }

      const isCommittedCourierShipment =
        shipment.provider === "courier_guy" &&
        courierGuyCostReservationStatuses.includes(
          shipment.status as (typeof courierGuyCostReservationStatuses)[number],
        );
      const reservesSelectedQuote =
        isCommittedCourierShipment &&
        (shipment.bookingQuoteStatus === "selected" ||
          shipment.bookingQuoteStatus === "booked") &&
        shipment.bookingQuoteAmount !== null;

      if (!reservesSelectedQuote) {
        if (isCommittedCourierShipment) {
          unresolvedCommittedCourierShipments += 1;
        }

        return total;
      }

      const bookingQuoteAmount = Number(shipment.bookingQuoteAmount);

      if (!Number.isFinite(bookingQuoteAmount) || bookingQuoteAmount < 0) {
        throw new Error(
          "A reserved Courier Guy quote is invalid. Resolve it before booking another shipment for this order.",
        );
      }

      return total + bookingQuoteAmount;
    }, 0);

    if (
      prepared.context.config.maxAbsorbedAmount !== null &&
      unresolvedCommittedCourierShipments > 0
    ) {
      throw new Error(
        `${unresolvedCommittedCourierShipments} other committed Courier Guy shipment${unresolvedCommittedCourierShipments === 1 ? " has" : "s have"} no auditable carrier cost. Resolve ${unresolvedCommittedCourierShipments === 1 ? "it" : "them"} before booking against this order's absorbed-cost limit.`,
      );
    }

    const serializedSafety = evaluateCourierGuyBookingQuoteSafety({
      approvedProviderAmount,
      customerShippingAmount: Number(lockedOrder.shippingTotal),
      freshProviderAmount: prepared.freshRate.providerAmount,
      maxAbsorbedAmount: prepared.context.config.maxAbsorbedAmount,
      maxBookingCostAmount: prepared.context.config.maxBookingCostAmount,
      otherProviderCosts,
    });

    if (!serializedSafety.allowed) {
      if (serializedSafety.reason === "approved_quote_exceeded") {
        throw new Error(
          "The Courier Guy rate changed before booking. Review a fresh quote before continuing.",
        );
      }

      if (serializedSafety.reason === "booking_cost_limit_exceeded") {
        throw new Error(
          `The fresh Courier Guy rate exceeds the R ${prepared.context.config.maxBookingCostAmount?.toFixed(2)} per-shipment safety limit.`,
        );
      }

      throw new Error(
        `Another shipment changed this order's carrier spend. Booking now would make Jurgens absorb R ${centsToMoney(serializedSafety.projectedAbsorbedAmountCents).toFixed(2)}, above the configured R ${prepared.context.config.maxAbsorbedAmount?.toFixed(2)} limit.`,
      );
    }

    const [claimedShipment] = await tx
      .update(shipments)
      .set({
        providerAccountCode: prepared.context.config.accountCode,
        providerEnvironment: prepared.context.config.mode,
        status: "booking",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.provider, "courier_guy"),
          eq(shipments.status, "pending_booking"),
          eq(shipments.bookingQuoteId, prepared.quote.id),
        ),
      )
      .returning({ id: shipments.id });

    if (!claimedShipment) {
      return null;
    }

    const [selectedQuote] = await tx
      .update(shippingRateQuotes)
      .set({ status: "selected" })
      .where(
        and(
          eq(shippingRateQuotes.id, prepared.quote.id),
          eq(shippingRateQuotes.status, "quoted"),
          gt(shippingRateQuotes.expiresAt, new Date()),
        ),
      )
      .returning({ id: shippingRateQuotes.id });

    if (!selectedQuote) {
      throw new Error(
        "The provider quote changed before booking could begin. Get a fresh quote.",
      );
    }

    return claimedShipment;
  });

  if (!claimed) {
    const existing = await getCourierGuyShipmentRecord(shipmentId);

    if (
      existing?.provider === "courier_guy" &&
      existing.providerShipmentId &&
      existing.trackingNumber
    ) {
      await synchronizeCourierGuyShipmentOutcome({
        orderId: existing.orderId,
        shipmentId,
      });

      return {
        alreadyBooked: true as const,
        providerShipmentId: existing.providerShipmentId,
        trackingReference: existing.trackingNumber,
      };
    }

    throw new Error(
      existing?.status === "booking"
        ? `This booking has an uncertain outcome. Search The Courier Guy portal for customer reference ${createCourierGuyBookingReference(existing.orderNumber, shipmentId)} before taking further action.`
        : "Only pending Courier Guy shipments can be booked.",
    );
  }

  try {
    const { context, freshRate: selectedRate, quote } = prepared;
    const selectedService = resolveCourierGuySelectedService(selectedRate);
    bookingReference = createCourierGuyBookingReference(
      context.record.orderNumber,
      shipmentId,
    );
    providerCreationAttempted = true;
    const booked = await context.client.createShipment({
      collectionContact: context.collectionContact,
      collectionOrigin: context.collectionOrigin,
      customerReference: bookingReference,
      customerReferenceName: "Jurgens Energy order",
      deliveryAddress: context.deliveryAddress,
      deliveryContact: context.deliveryContact,
      muteNotifications: true,
      parcels: [context.courierParcel],
      ...selectedService,
    });
    const now = new Date();
    const providerCost =
      booked.providerCostAmount ?? selectedRate.providerAmount;
    const costExceededApprovedQuote = actualCostExceededApprovedQuote({
      actualProviderAmount: providerCost,
      approvedProviderAmount,
    });
    const trackingUrl = createCourierGuyCustomerTrackingUrl(
      booked.trackingReference,
    );
    await db.transaction(async (tx) => {
      const [persistedBooking] = await tx
        .update(shipments)
        .set({
          bookedAt: now,
          providerCostAmount: providerCost.toFixed(2),
          providerCostCurrency: "ZAR",
          providerAccountCode: context.config.accountCode,
          providerEnvironment: context.config.mode,
          providerShipmentId: booked.providerShipmentId,
          serviceCode: selectedRate.serviceCode,
          serviceName: selectedRate.serviceName,
          status: "booked",
          trackingNumber: booked.trackingReference,
          trackingUrl,
          updatedAt: now,
          waybillNumber: booked.trackingReference,
        })
        .where(
          and(
            eq(shipments.id, shipmentId),
            eq(shipments.status, "booking"),
            eq(shipments.bookingQuoteId, quote.id),
          ),
        )
        .returning({ id: shipments.id });

      if (!persistedBooking) {
        throw new Error(
          "The Courier Guy booking was created but could not be attached to the local shipment.",
        );
      }

      const [bookedQuote] = await tx
        .update(shippingRateQuotes)
        .set({ status: "booked" })
        .where(
          and(
            eq(shippingRateQuotes.id, quote.id),
            eq(shippingRateQuotes.status, "selected"),
          ),
        )
        .returning({ id: shippingRateQuotes.id });

      if (!bookedQuote) {
        throw new Error(
          "The Courier Guy booking was created but its approved quote could not be finalized locally.",
        );
      }
    });

    await replayUnmatchedCourierGuyWebhookEvents({
      environment: context.config.mode,
      providerShipmentId: booked.providerShipmentId,
      trackingReference: booked.trackingReference,
    }).catch(() => undefined);

    const providerLabel = await context.client
      .getLabel({
        kind: "waybill",
        shipmentId: booked.providerShipmentId,
      })
      .catch(() => null);
    const label =
      providerLabel && new URL(providerLabel.url).protocol === "https:"
        ? providerLabel
        : null;

    await db.transaction(async (tx) => {
      if (label) {
        await tx
          .update(shipments)
          .set({ updatedAt: now, waybillUrl: label.url })
          .where(
            and(
              eq(shipments.id, shipmentId),
              eq(shipments.providerShipmentId, booked.providerShipmentId),
            ),
          );
      }

      await tx
        .update(shipments)
        .set({
          status: label ? "waybill_ready" : "booked",
          updatedAt: now,
        })
        .where(
          and(
            eq(shipments.id, shipmentId),
            eq(shipments.status, "booked"),
          ),
        );

      await tx
        .insert(shipmentEvents)
        .values({
          message: `Booked with ${selectedRate.serviceName}.`,
          occurredAt: now,
          payload: {
            actualCostExceededApprovedQuote: costExceededApprovedQuote,
            approvedProviderAmount,
            bookingReference,
            freshProviderAmount: selectedRate.providerAmount,
            providerCost,
            rate: selectedRate,
            waybillReady: Boolean(label),
          },
          provider: "courier_guy",
          providerEventId: `booking:${booked.providerShipmentId}`,
          shipmentId,
          status: "booked",
        })
        .onConflictDoNothing();
    });
    await synchronizeCourierGuyShipmentOutcome({
      orderId: context.record.orderId,
      shipmentId,
    });

    return {
      alreadyBooked: false as const,
      actualCostExceededApprovedQuote: costExceededApprovedQuote,
      approvedProviderAmount,
      providerCost,
      providerShipmentId: booked.providerShipmentId,
      serviceName: selectedRate.serviceName,
      trackingReference: booked.trackingReference,
      waybillUrl: label?.url ?? null,
    };
  } catch (error) {
    const providerDefinitelyRejected =
      !providerCreationAttempted ||
      isCourierGuyRequestDefinitelyRejected(error);

    if (providerDefinitelyRejected) {
      await db.transaction(async (tx) => {
        await tx
          .update(shipments)
          .set({
            bookingQuoteId: null,
            providerAccountCode: null,
            providerEnvironment: null,
            status: "pending_booking",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(shipments.id, shipmentId),
              eq(shipments.status, "booking"),
              eq(shipments.bookingQuoteId, prepared.quote.id),
            ),
          );

        await tx
          .update(shippingRateQuotes)
          .set({ status: "expired" })
          .where(
            and(
              eq(shippingRateQuotes.id, prepared.quote.id),
              eq(shippingRateQuotes.status, "selected"),
            ),
          );
      });
    } else {
      const existing = await getCourierGuyShipmentRecord(shipmentId).catch(
        () => null,
      );

      if (existing?.providerShipmentId && existing.trackingNumber) {
        await synchronizeCourierGuyShipmentOutcome({
          orderId: existing.orderId,
          shipmentId,
        });

        return {
          alreadyBooked: true as const,
          providerShipmentId: existing.providerShipmentId,
          trackingReference: existing.trackingNumber,
        };
      }

      const reference =
        bookingReference ??
        createCourierGuyBookingReference(
          existing?.orderNumber ?? "ORDER",
          shipmentId,
        );

      await db
        .insert(shipmentEvents)
        .values({
          message:
            "Courier Guy booking outcome needs reconciliation before another booking is attempted.",
          occurredAt: new Date(),
          payload: {
            bookingReference: reference,
            error:
              error instanceof Error
                ? error.message
                : "Unknown Courier Guy booking error.",
          },
          provider: "courier_guy",
          providerEventId: `booking-ambiguous:${shipmentId}`,
          shipmentId,
          status: "booking_needs_reconciliation",
        })
        .onConflictDoNothing()
        .catch(() => undefined);

      throw new Error(
        `Courier Guy may have created this shipment. Do not book it again; search The Courier Guy portal for customer reference ${reference} and reconcile the result.`,
        { cause: error },
      );
    }

    throw error;
  }
}

export async function reconcileCourierGuyBooking({
  shipmentId,
  trackingReference: enteredTrackingReference,
}: {
  shipmentId: string;
  trackingReference: string;
}) {
  const record = await getCourierGuyShipmentRecord(shipmentId);

  if (!record || record.provider !== "courier_guy") {
    throw new Error(
      "Only Courier Guy shipments awaiting booking reconciliation can be adopted.",
    );
  }

  const requestedTrackingReference = enteredTrackingReference.trim();

  if (record.status !== "booking") {
    if (
      record.providerShipmentId &&
      record.trackingNumber &&
      record.trackingNumber === requestedTrackingReference
    ) {
      await synchronizeCourierGuyBookingBatchAfterReconciliation(shipmentId);

      return {
        bookingReference: createCourierGuyBookingReference(
          record.orderNumber,
          shipmentId,
        ),
        providerShipmentId: record.providerShipmentId,
        status: record.status,
        trackingReference: record.trackingNumber,
        waybillUrl: record.waybillUrl,
      };
    }

    throw new Error(
      "Only Courier Guy shipments awaiting booking reconciliation can be adopted.",
    );
  }

  if (!record.providerAccountCode || !record.providerEnvironment) {
    throw new Error(
      "This uncertain booking does not have a saved Courier Guy account environment.",
    );
  }

  const config = await getCourierGuyOperationalConfig({
    accountCode: record.providerAccountCode,
    mode: record.providerEnvironment,
  });

  if (!config.hasCredentials || !config.accountCode || !config.apiKey) {
    throw new Error(
      `Courier Guy ${config.mode} credentials for this shipment are not configured.`,
    );
  }

  const trackingReference = requestedTrackingReference;
  const client = createCourierGuyClient({
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
  });
  const tracking = await client.trackShipment({ trackingReference });
  const expectedBookingReference = createCourierGuyBookingReference(
    record.orderNumber,
    shipmentId,
  );

  if (
    !matchesCourierGuyBookingReference(
      expectedBookingReference,
      tracking.customerReference,
    )
  ) {
    throw new Error(
      `The tracking reference is not linked to booking reference ${expectedBookingReference}. Nothing was changed.`,
    );
  }

  if (!tracking.providerShipmentId) {
    throw new Error(
      "Courier Guy verified the tracking reference but did not return a shipment ID.",
    );
  }

  const verifiedTrackingReference =
    tracking.trackingReference.trim() || trackingReference;

  if (verifiedTrackingReference.length > 160) {
    throw new Error(
      "Courier Guy returned a tracking reference that is too long to store safely.",
    );
  }

  const [conflictingShipment] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(
      and(
        eq(shipments.provider, "courier_guy"),
        eq(shipments.providerEnvironment, config.mode),
        ne(shipments.id, shipmentId),
        or(
          eq(shipments.providerShipmentId, tracking.providerShipmentId),
          eq(shipments.trackingNumber, verifiedTrackingReference),
        ),
      ),
    )
    .limit(1);

  if (conflictingShipment) {
    throw new Error(
      "That Courier Guy booking is already attached to another local shipment.",
    );
  }

  const label = await client
    .getLabel({
      kind: "waybill",
      shipmentId: tracking.providerShipmentId,
    })
    .catch(() => null);
  let waybillUrl: string | null = null;

  if (label) {
    const url = new URL(label.url);

    if (url.protocol !== "https:") {
      throw new Error("Courier Guy returned an unsafe waybill URL.");
    }

    waybillUrl = url.toString();
  }

  const now = new Date();
  const providerCollectedAt = parseProviderDate(tracking.collectedAt);
  const providerDeliveredAt = parseProviderDate(tracking.deliveredAt);
  let nextStatus = resolveCourierGuyShipmentStatus(
    record.status,
    tracking.status,
  );

  if (providerDeliveredAt) {
    nextStatus = resolveCourierGuyShipmentStatus(nextStatus, "delivered");
  }

  if (nextStatus === "booking") {
    nextStatus = waybillUrl ? "waybill_ready" : "booked";
  } else if (nextStatus === "booked" && waybillUrl) {
    nextStatus = "waybill_ready";
  }

  const milestones = resolveCourierGuyMilestones({
    currentCollectedAt: record.collectedAt,
    currentDeliveredAt: record.deliveredAt,
    nextStatus,
    occurredAt: now,
    providerCollectedAt,
    providerDeliveredAt,
  });
  const eventRows = tracking.events.map((event) => ({
    location: event.location,
    message: event.message,
    occurredAt: parseProviderDate(event.occurredAt) ?? now,
    payload: event.data,
    provider: "courier_guy" as const,
    providerEventId: createCourierGuyTrackingEventId({
      data: event.data,
      location: event.location,
      message: event.message,
      occurredAt: event.occurredAt,
      parcelId: event.parcelId,
      providerEventId: event.providerEventId,
      shipmentIdentity: verifiedTrackingReference,
      source: event.source,
      status: event.status,
    }),
    shipmentId,
    status: event.status,
  }));

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        bookingQuoteId: shipments.bookingQuoteId,
        providerAccountCode: shipments.providerAccountCode,
        providerEnvironment: shipments.providerEnvironment,
        status: shipments.status,
      })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");

    if (
      !current ||
      current.status !== "booking" ||
      current.providerEnvironment !== config.mode ||
      current.providerAccountCode?.trim() !== config.accountCode
    ) {
      throw new Error(
        "The shipment changed while the Courier Guy booking was being verified. Refresh before continuing.",
      );
    }

    if (eventRows.length > 0) {
      await tx
        .insert(shipmentEvents)
        .values(eventRows)
        .onConflictDoNothing();
    }

    await tx
      .insert(shipmentEvents)
      .values({
        message:
          "Uncertain Courier Guy booking verified and attached by an administrator.",
        occurredAt: now,
        payload: {
          bookingReference: expectedBookingReference,
          providerShipmentId: tracking.providerShipmentId,
          trackingReference: verifiedTrackingReference,
          waybillReady: Boolean(waybillUrl),
        },
        provider: "courier_guy",
        providerEventId: `booking-reconciled:${tracking.providerShipmentId}`,
        shipmentId,
        status: "booking_reconciled",
      })
      .onConflictDoNothing();

    const [adopted] = await tx
      .update(shipments)
      .set({
        bookedAt: now,
        collectedAt: milestones.collectedAt,
        deliveredAt: milestones.deliveredAt,
        providerShipmentId: tracking.providerShipmentId,
        status: nextStatus,
        trackingNumber: verifiedTrackingReference,
        trackingUrl: createCourierGuyCustomerTrackingUrl(
          verifiedTrackingReference,
        ),
        updatedAt: now,
        waybillNumber: verifiedTrackingReference,
        waybillUrl,
      })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.status, "booking"),
        ),
      )
      .returning({ id: shipments.id });

    if (!adopted) {
      throw new Error(
        "The verified Courier Guy booking could not be attached to the shipment.",
      );
    }

    if (current.bookingQuoteId) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "booked" })
        .where(
          and(
            eq(shippingRateQuotes.id, current.bookingQuoteId),
            eq(shippingRateQuotes.provider, "courier_guy"),
            ne(shippingRateQuotes.status, "cancelled"),
          ),
        );
    }
  });

  await replayUnmatchedCourierGuyWebhookEvents({
    environment: config.mode,
    providerShipmentId: tracking.providerShipmentId,
    trackingReference: verifiedTrackingReference,
  }).catch(() => undefined);
  await synchronizeCourierGuyShipmentOutcome({
    orderId: record.orderId,
    shipmentId,
  });
  await synchronizeCourierGuyBookingBatchAfterReconciliation(shipmentId);

  return {
    bookingReference: expectedBookingReference,
    providerShipmentId: tracking.providerShipmentId,
    status: nextStatus,
    trackingReference: verifiedTrackingReference,
    waybillUrl,
  };
}

export async function refreshCourierGuyShipment(shipmentId: string) {
  const record = await getCourierGuyShipmentRecord(shipmentId);

  if (
    !record ||
    record.provider !== "courier_guy" ||
    !record.trackingNumber
  ) {
    throw new Error("This shipment does not have Courier Guy tracking yet.");
  }

  const config = await getCourierGuyOperationalConfig({
    accountCode: record.providerAccountCode,
    mode: record.providerEnvironment,
  });

  if (!config.hasCredentials || !config.accountCode || !config.apiKey) {
    throw new Error(
      `Courier Guy ${config.mode} credentials for this shipment are not configured.`,
    );
  }

  const client = createCourierGuyClient({
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
  });
  const tracking = await client.trackShipment({
    trackingReference: record.trackingNumber,
  });
  const trackingReference =
    tracking.trackingReference.trim() || record.trackingNumber;
  const label =
    !record.waybillUrl && record.providerShipmentId
      ? await client
          .getLabel({
            kind: "waybill",
            shipmentId: record.providerShipmentId,
          })
          .catch(() => null)
      : null;
  const now = new Date();
  const providerCollectedAt = parseProviderDate(tracking.collectedAt);
  const providerDeliveredAt = parseProviderDate(tracking.deliveredAt);
  const shipmentIdentity =
    tracking.trackingReference ||
    tracking.providerShipmentId ||
    record.trackingNumber;
  const eventRows = tracking.events.map((event) => ({
    location: event.location,
    message: event.message,
    occurredAt: parseProviderDate(event.occurredAt) ?? now,
    payload: event.data,
    provider: "courier_guy" as const,
    providerEventId: createCourierGuyTrackingEventId({
      data: event.data,
      location: event.location,
      message: event.message,
      occurredAt: event.occurredAt,
      parcelId: event.parcelId,
      providerEventId: event.providerEventId,
      shipmentIdentity,
      source: event.source,
      status: event.status,
    }),
    shipmentId,
    status: event.status,
  }));
  let eventCount = 0;
  let nextStatus = record.status;

  await db.transaction(async (tx) => {
    const [currentShipment] = await tx
      .select({
        collectedAt: shipments.collectedAt,
        deliveredAt: shipments.deliveredAt,
        providerShipmentId: shipments.providerShipmentId,
        status: shipments.status,
        waybillUrl: shipments.waybillUrl,
      })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");

    if (!currentShipment) {
      throw new Error("Shipment could not be found.");
    }

    nextStatus = resolveCourierGuyShipmentStatus(
      currentShipment.status,
      tracking.status,
    );

    if (providerDeliveredAt) {
      nextStatus = resolveCourierGuyShipmentStatus(
        nextStatus,
        "delivered",
      );
    }

    if (
      nextStatus === "booked" &&
      (currentShipment.waybillUrl || label)
    ) {
      nextStatus = "waybill_ready";
    }

    const milestones = resolveCourierGuyMilestones({
      currentCollectedAt: currentShipment.collectedAt,
      currentDeliveredAt: currentShipment.deliveredAt,
      nextStatus,
      occurredAt: now,
      providerCollectedAt,
      providerDeliveredAt,
    });

    if (eventRows.length > 0) {
      const insertedEvents = await tx
        .insert(shipmentEvents)
        .values(eventRows)
        .onConflictDoNothing()
        .returning({ id: shipmentEvents.id });

      eventCount = insertedEvents.length;
    }

    await tx
      .update(shipments)
      .set({
        collectedAt: milestones.collectedAt,
        deliveredAt: milestones.deliveredAt,
        providerShipmentId:
          tracking.providerShipmentId ??
          currentShipment.providerShipmentId,
        status: nextStatus,
        trackingUrl: createCourierGuyCustomerTrackingUrl(
          trackingReference,
        ),
        updatedAt: now,
        ...(label ? { waybillUrl: label.url } : {}),
      })
      .where(eq(shipments.id, shipmentId));
  });

  await replayUnmatchedCourierGuyWebhookEvents({
    environment: config.mode,
    providerShipmentId:
      tracking.providerShipmentId ?? record.providerShipmentId,
    trackingReference,
  }).catch(() => undefined);
  await synchronizeCourierGuyShipmentOutcome({
    orderId: record.orderId,
    shipmentId,
  });
  await synchronizeCourierGuyBookingBatchAfterReconciliation(shipmentId);

  return {
    eventCount,
    status: nextStatus,
    trackingReference: tracking.trackingReference,
  };
}

export async function getFreshCourierGuyWaybillUrl(shipmentId: string) {
  const record = await getCourierGuyShipmentRecord(shipmentId);

  if (
    !record ||
    record.provider !== "courier_guy" ||
    !record.providerShipmentId
  ) {
    throw new Error("This Courier Guy shipment has not been booked.");
  }

  const config = await getCourierGuyOperationalConfig({
    accountCode: record.providerAccountCode,
    mode: record.providerEnvironment,
  });

  if (!config.hasCredentials || !config.accountCode || !config.apiKey) {
    throw new Error(
      `Courier Guy ${config.mode} credentials for this shipment are not configured.`,
    );
  }

  const client = createCourierGuyClient({
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
  });
  const label = await client.getLabel({
    kind: "waybill",
    shipmentId: record.providerShipmentId,
  });
  const url = new URL(label.url);

  if (url.protocol !== "https:") {
    throw new Error("Courier Guy returned an unsafe waybill URL.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(shipments)
      .set({ updatedAt: now, waybillUrl: url.toString() })
      .where(eq(shipments.id, shipmentId));
    await tx
      .update(shipments)
      .set({ status: "waybill_ready", updatedAt: now })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.status, "booked"),
        ),
      );
  });

  return url.toString();
}

export async function cancelBookedCourierGuyShipment(shipmentId: string) {
  const record = await getCourierGuyShipmentRecord(shipmentId);

  if (
    !record ||
    record.provider !== "courier_guy" ||
    !record.trackingNumber
  ) {
    throw new Error("This Courier Guy shipment has not been booked.");
  }

  const config = await getCourierGuyOperationalConfig({
    accountCode: record.providerAccountCode,
    mode: record.providerEnvironment,
  });

  if (!config.hasCredentials || !config.accountCode || !config.apiKey) {
    throw new Error(
      `Courier Guy ${config.mode} credentials for this shipment are not configured.`,
    );
  }

  if (
    !courierGuyCancellableShipmentStatuses.some(
      (status) => status === record.status,
    )
  ) {
    throw new Error(
      record.status === "cancelling"
        ? "This cancellation is already awaiting confirmation."
        : "Courier Guy shipments can only be cancelled before handover.",
    );
  }

  const [claimed] = await db
    .update(shipments)
    .set({ status: "cancelling", updatedAt: new Date() })
    .where(
      and(
        eq(shipments.id, shipmentId),
        eq(shipments.provider, "courier_guy"),
        inArray(shipments.status, [
          "booked",
          "waybill_ready",
        ]),
        eq(shipments.status, record.status),
      ),
    )
    .returning({ id: shipments.id });

  if (!claimed) {
    throw new Error(
      "The shipment status changed before cancellation could start. Refresh tracking and try again if it is still eligible.",
    );
  }

  try {
    await cancelCourierGuyShipment(
      {
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
      },
      { trackingReference: record.trackingNumber },
    );
  } catch (error) {
    if (isCourierGuyRequestDefinitelyRejected(error)) {
      await db
        .update(shipments)
        .set({ status: record.status, updatedAt: new Date() })
        .where(
          and(
            eq(shipments.id, shipmentId),
            eq(shipments.status, "cancelling"),
          ),
        );
    } else {
      await db
        .insert(shipmentEvents)
        .values({
          message:
            "Courier Guy cancellation outcome needs tracking confirmation.",
          occurredAt: new Date(),
          payload: {
            error:
              error instanceof Error
                ? error.message
                : "Unknown Courier Guy cancellation error.",
          },
          provider: "courier_guy",
          providerEventId: `cancellation-ambiguous:${shipmentId}`,
          shipmentId,
          status: "cancellation_pending_confirmation",
        })
        .onConflictDoNothing()
        .catch(() => undefined);

      throw new Error(
        "Courier Guy may have accepted the cancellation. Refresh tracking before taking further action.",
        { cause: error },
      );
    }

    throw error;
  }

  const now = new Date();
  const [cancelled] = await db.transaction(async (tx) => {
    const updated = await tx
      .update(shipments)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.status, "cancelling"),
        ),
      )
      .returning({ id: shipments.id });

    if (updated.length > 0) {
      await tx
        .insert(shipmentEvents)
        .values({
          message: "Shipment cancelled through The Courier Guy.",
          occurredAt: now,
          provider: "courier_guy",
          providerEventId: `cancelled:${record.trackingNumber}`,
          shipmentId,
          status: "cancelled",
        })
        .onConflictDoNothing();
    }

    return updated;
  });

  if (!cancelled) {
    const current = await getCourierGuyShipmentRecord(shipmentId);

    if (current?.status !== "cancelled") {
      throw new Error(
        "Courier Guy accepted the cancellation, but a newer tracking state was received. Refresh tracking to confirm the final status.",
      );
    }
  }
  await synchronizeCourierGuyShipmentOutcome({
    orderId: record.orderId,
    shipmentId,
  });

  return { cancelled: true as const };
}

export function selectCourierGuyRate(
  rates: CourierGuyRate[],
  preferredServiceCode: string | null,
) {
  return selectCourierGuyRateRule(rates, preferredServiceCode);
}

async function getCourierGuyShipmentRecord(shipmentId: string) {
  const [record] = await db
    .select({
      bookingQuoteId: shipments.bookingQuoteId,
      collectedAt: shipments.collectedAt,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveredAt: shipments.deliveredAt,
      deliveryAddress: orders.deliveryAddressSnapshot,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      provider: shipments.provider,
      providerAccountCode: shipments.providerAccountCode,
      providerEnvironment: shipments.providerEnvironment,
      providerShipmentId: shipments.providerShipmentId,
      status: shipments.status,
      trackingNumber: shipments.trackingNumber,
      waybillUrl: shipments.waybillUrl,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.id, shipmentId))
    .limit(1);

  return record ?? null;
}

async function synchronizeCourierGuyShipmentOutcome({
  orderId,
  shipmentId,
}: {
  orderId: string;
  shipmentId: string;
}) {
  const results = await Promise.allSettled([
    reconcileOrderFulfillment(orderId),
    sendCourierGuyShipmentStatusNotification(shipmentId),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        index === 0
          ? "[courier-guy] order fulfilment reconciliation failed"
          : "[courier-guy] customer shipment notification failed",
        result.reason,
      );
    }
  });
}

function parseProviderDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
