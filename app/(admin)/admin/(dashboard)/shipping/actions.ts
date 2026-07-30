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

export type ShippingActionState = {
  message: string;
  ok: boolean;
};

const shipmentIdSchema = z.string().uuid();
const trackingReferenceSchema = z
  .string()
  .trim()
  .min(1, "Enter the Courier Guy tracking reference.")
  .max(160, "The tracking reference is too long.");

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

export async function bookCourierGuyShipmentAction(
  _state: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const session = await requireShippingManageAccess();
  const shipmentId = parseShipmentId(formData);

  try {
    const result = await bookCourierGuyShipment(shipmentId);

    await db.insert(auditLogs).values({
      action: "shipping.courier_guy.booked",
      actorUserId: session.user.id,
      entityId: shipmentId,
      entityType: "shipment",
      metadata: JSON.stringify({
        alreadyBooked: result.alreadyBooked,
        providerShipmentId: result.providerShipmentId,
        trackingReference: result.trackingReference,
      }),
    });
    revalidatePath("/shipping");

    return {
      message: result.alreadyBooked
        ? `Shipment was already booked as ${result.trackingReference}.`
        : `Courier Guy shipment booked as ${result.trackingReference}.`,
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Courier Guy booking failed.",
      ok: false,
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
