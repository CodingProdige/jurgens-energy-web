"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/src/db";
import { auditLogs } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  bookCourierGuyShipment,
  cancelBookedCourierGuyShipment,
  reconcileCourierGuyBooking,
  refreshCourierGuyShipment,
} from "@/src/modules/shipping/courier-guy-shipments";
import {
  createCourierGuyBookingQuote,
  saveCourierGuyShipmentParcel,
  type CourierGuyBookingQuoteView,
} from "@/src/modules/shipping/courier-guy-booking-quotes";

export type ShippingActionState = {
  bookingBlocked?: boolean;
  caution?: boolean;
  message: string;
  ok: boolean;
  requiresFreshQuote?: boolean;
};

export type CourierGuyQuoteActionState = ShippingActionState & {
  quote: CourierGuyBookingQuoteView | null;
};

const shipmentIdSchema = z.string().uuid();
const bookingConfirmationSchema = z.object({
  quoteId: z.string().uuid(),
  shipmentId: shipmentIdSchema,
});
const trackingReferenceSchema = z
  .string()
  .trim()
  .min(1, "Enter the Courier Guy tracking reference.")
  .max(160, "The tracking reference is too long.");
const parcelSchema = z.object({
  heightMm: z.coerce
    .number()
    .finite()
    .positive("Packed height must be greater than zero.")
    .max(100_000),
  lengthMm: z.coerce
    .number()
    .finite()
    .positive("Packed length must be greater than zero.")
    .max(100_000),
  shipmentId: shipmentIdSchema,
  weightGrams: z.coerce
    .number()
    .finite()
    .positive("Packed weight must be greater than zero.")
    .max(10_000_000),
  widthMm: z.coerce
    .number()
    .finite()
    .positive("Packed width must be greater than zero.")
    .max(100_000),
});

function requiresFreshCourierGuyQuote(message: string) {
  return (
    /\bquote\b/i.test(message) &&
    /\b(?:expired|fresh|get|invalid|latest|newer|replaced|review|reviewed)\b/i.test(
      message,
    )
  );
}

async function requireShippingManageAccess() {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage shipments.");
  }

  return access.session;
}

function parseShipmentId(formData: FormData) {
  return shipmentIdSchema.parse(String(formData.get("shipmentId") ?? ""));
}

export async function quoteCourierGuyShipmentAction(
  _state: CourierGuyQuoteActionState,
  formData: FormData,
): Promise<CourierGuyQuoteActionState> {
  const session = await requireShippingManageAccess();
  const shipmentId = parseShipmentId(formData);

  try {
    const quote = await createCourierGuyBookingQuote(shipmentId);

    await db.insert(auditLogs).values({
      action: "shipping.courier_guy.quote_created",
      actorUserId: session.user.id,
      entityId: shipmentId,
      entityType: "shipment",
      metadata: JSON.stringify({
        allowed: quote.allowed,
        expiresAt: quote.expiresAt,
        projectedAbsorbedAmount: quote.projectedAbsorbedAmount,
        projectedProviderSpend: quote.projectedProviderSpend,
        providerAmount: quote.providerAmount,
        quoteId: quote.quoteId,
        serviceCode: quote.serviceCode,
      }),
    });
    revalidatePath("/shipping");

    return {
      message: quote.allowed
        ? "Live Courier Guy quote ready for review."
        : "The live quote exceeds a configured shipping safety limit.",
      ok: true,
      quote,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Courier Guy quote could not be created.",
      ok: false,
      quote: null,
    };
  }
}

export async function saveCourierGuyShipmentParcelAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const session = await requireShippingManageAccess();
  const parsed = parcelSchema.safeParse({
    heightMm: formData.get("heightMm"),
    lengthMm: formData.get("lengthMm"),
    shipmentId: String(formData.get("shipmentId") ?? ""),
    weightGrams: formData.get("weightGrams"),
    widthMm: formData.get("widthMm"),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ?? "Check the packed parcel details.",
      ok: false,
    };
  }

  try {
    const result = await saveCourierGuyShipmentParcel(parsed.data);

    await db.insert(auditLogs).values({
      action: result.created
        ? "shipping.courier_guy.parcel_created"
        : "shipping.courier_guy.parcel_updated",
      actorUserId: session.user.id,
      entityId: parsed.data.shipmentId,
      entityType: "shipment",
      metadata: JSON.stringify({
        heightMm: parsed.data.heightMm,
        lengthMm: parsed.data.lengthMm,
        weightGrams: parsed.data.weightGrams,
        widthMm: parsed.data.widthMm,
      }),
    });
    revalidatePath("/shipping");

    return {
      message: result.created
        ? "Packed parcel details added. You can request a quote now."
        : "Packed parcel details updated. Request a fresh quote before booking.",
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Packed parcel details could not be saved.",
      ok: false,
    };
  }
}

export async function bookCourierGuyShipmentAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const session = await requireShippingManageAccess();
  const parsed = bookingConfirmationSchema.safeParse({
    quoteId: String(formData.get("quoteId") ?? ""),
    shipmentId: String(formData.get("shipmentId") ?? ""),
  });

  if (!parsed.success) {
    return {
      bookingBlocked: true,
      message: "The reviewed quote is invalid. Get a fresh quote before booking.",
      ok: false,
      requiresFreshQuote: true,
    };
  }

  const { quoteId, shipmentId } = parsed.data;

  try {
    const result = await bookCourierGuyShipment(shipmentId, quoteId);

    await db.insert(auditLogs).values({
      action: "shipping.courier_guy.booked",
      actorUserId: session.user.id,
      entityId: shipmentId,
      entityType: "shipment",
      metadata: JSON.stringify({
        actualCostExceededApprovedQuote:
          "actualCostExceededApprovedQuote" in result
            ? result.actualCostExceededApprovedQuote
            : false,
        alreadyBooked: result.alreadyBooked,
        approvedProviderAmount:
          "approvedProviderAmount" in result
            ? result.approvedProviderAmount
            : null,
        providerCost:
          "providerCost" in result ? result.providerCost : null,
        providerShipmentId: result.providerShipmentId,
        quoteId,
        trackingReference: result.trackingReference,
      }),
    });
    revalidatePath("/shipping");

    const costExceededApprovedQuote =
      !result.alreadyBooked && result.actualCostExceededApprovedQuote;

    return {
      caution: costExceededApprovedQuote,
      message: result.alreadyBooked
        ? `Shipment was already booked as ${result.trackingReference}.`
        : costExceededApprovedQuote
          ? `Shipment booked as ${result.trackingReference}, but Courier Guy returned a final cost above the approved quote. Review the recorded carrier cost immediately.`
          : `Courier Guy shipment booked as ${result.trackingReference} for R ${result.providerCost.toFixed(2)}.`,
      ok: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Courier Guy booking failed.";

    revalidatePath("/shipping");

    return {
      bookingBlocked: true,
      message,
      ok: false,
      requiresFreshQuote: requiresFreshCourierGuyQuote(message),
    };
  }
}

export async function refreshCourierGuyShipmentAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  await requireShippingManageAccess();
  const shipmentId = parseShipmentId(formData);

  try {
    const result = await refreshCourierGuyShipment(shipmentId);

    revalidatePath("/shipping");

    return {
      message: `Tracking refreshed: ${result.status.replaceAll("_", " ")}.`,
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Courier Guy tracking refresh failed.",
      ok: false,
    };
  }
}

export async function reconcileCourierGuyBookingAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const session = await requireShippingManageAccess();
  const shipmentId = parseShipmentId(formData);
  const parsedTrackingReference = trackingReferenceSchema.safeParse(
    String(formData.get("trackingReference") ?? ""),
  );

  if (!parsedTrackingReference.success) {
    return {
      message:
        parsedTrackingReference.error.issues[0]?.message ??
        "Enter the Courier Guy tracking reference.",
      ok: false,
    };
  }

  try {
    const result = await reconcileCourierGuyBooking({
      shipmentId,
      trackingReference: parsedTrackingReference.data,
    });

    await db.insert(auditLogs).values({
      action: "shipping.courier_guy.booking_reconciled",
      actorUserId: session.user.id,
      entityId: shipmentId,
      entityType: "shipment",
      metadata: JSON.stringify({
        bookingReference: result.bookingReference,
        providerShipmentId: result.providerShipmentId,
        trackingReference: result.trackingReference,
        waybillReady: Boolean(result.waybillUrl),
      }),
    });
    revalidatePath("/shipping");

    return {
      message: `Courier Guy booking adopted as ${result.trackingReference}.`,
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Courier Guy booking reconciliation failed.",
      ok: false,
    };
  }
}

export async function cancelCourierGuyShipmentAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const session = await requireShippingManageAccess();
  const shipmentId = parseShipmentId(formData);

  try {
    await cancelBookedCourierGuyShipment(shipmentId);
    await db.insert(auditLogs).values({
      action: "shipping.courier_guy.cancelled",
      actorUserId: session.user.id,
      entityId: shipmentId,
      entityType: "shipment",
    });
    revalidatePath("/shipping");

    return { message: "Courier Guy shipment cancelled.", ok: true };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Courier Guy cancellation failed.",
      ok: false,
    };
  }
}
