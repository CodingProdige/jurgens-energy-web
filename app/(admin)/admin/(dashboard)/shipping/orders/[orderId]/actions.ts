"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { saveCourierGuyManualPackingPlan } from "@/src/modules/shipping/courier-guy-manual-packing";
import { manualPackingPackagesInputSchema } from "@/src/modules/shipping/courier-guy-manual-packing-rules";
import {
  confirmCourierGuyOrderBooking,
  createCourierGuyOrderBookingQuote,
  type CourierGuyOrderBookingQuoteView,
  type CourierGuyOrderBookingResult,
} from "@/src/modules/shipping/courier-guy-order-booking";

export type ManualPackingActionState = {
  message: string;
  ok: boolean;
};

export type CourierGuyOrderQuoteActionState = ManualPackingActionState & {
  quote: CourierGuyOrderBookingQuoteView | null;
};

export type CourierGuyOrderBookingActionState = ManualPackingActionState & {
  result: CourierGuyOrderBookingResult | null;
};

const uuidSchema = z.string().uuid();
const planActionSchema = z.object({
  orderId: uuidSchema,
  packagesJson: z.string().max(250_000),
});
const quoteActionSchema = z.object({ orderId: uuidSchema });
const bookingActionSchema = z.object({
  batchId: uuidSchema,
  orderId: uuidSchema,
});

async function requireShippingManageAccess() {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage shipments.");
  }

  return access.session;
}

function revalidatePackingPages(orderId: string) {
  revalidatePath("/shipping");
  revalidatePath(`/shipping/orders/${orderId}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function saveCourierGuyManualPackingPlanAction(
  _state: ManualPackingActionState,
  formData: FormData,
): Promise<ManualPackingActionState> {
  const session = await requireShippingManageAccess();
  const parsedAction = planActionSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    packagesJson: String(formData.get("packages") ?? ""),
  });

  if (!parsedAction.success) {
    return {
      message: "The packing plan payload is invalid. Refresh and try again.",
      ok: false,
    };
  }

  let decodedPackages: unknown;

  try {
    decodedPackages = JSON.parse(parsedAction.data.packagesJson);
  } catch {
    return {
      message: "The packing plan could not be read. Refresh and try again.",
      ok: false,
    };
  }

  const parsedPackages = manualPackingPackagesInputSchema.safeParse(
    decodedPackages,
  );

  if (!parsedPackages.success) {
    return {
      message:
        parsedPackages.error.issues[0]?.message ??
        "Check every package, allocation, weight, and dimension.",
      ok: false,
    };
  }

  try {
    await saveCourierGuyManualPackingPlan({
      actorUserId: session.user.id,
      orderId: parsedAction.data.orderId,
      packages: parsedPackages.data,
    });
    revalidatePackingPages(parsedAction.data.orderId);

    return {
      message:
        "Packing plan saved. Request fresh live quotes before booking the packages.",
      ok: true,
    };
  } catch (error) {
    return {
      message: errorMessage(error, "The packing plan could not be saved."),
      ok: false,
    };
  }
}

export async function quoteCourierGuyManualPackingOrderAction(
  _state: CourierGuyOrderQuoteActionState,
  formData: FormData,
): Promise<CourierGuyOrderQuoteActionState> {
  const session = await requireShippingManageAccess();
  const parsed = quoteActionSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
  });

  if (!parsed.success) {
    return {
      message: "The order is invalid. Refresh and try again.",
      ok: false,
      quote: null,
    };
  }

  try {
    const quote = await createCourierGuyOrderBookingQuote({
      actorUserId: session.user.id,
      orderId: parsed.data.orderId,
    });
    revalidatePackingPages(parsed.data.orderId);

    return {
      message: quote.allowed
        ? "Live quotes are ready for review."
        : "Booking is blocked by a configured shipping safety limit.",
      ok: true,
      quote,
    };
  } catch (error) {
    return {
      message: errorMessage(
        error,
        "Live Courier Guy quotes could not be created.",
      ),
      ok: false,
      quote: null,
    };
  }
}

export async function confirmCourierGuyManualPackingOrderAction(
  _state: CourierGuyOrderBookingActionState,
  formData: FormData,
): Promise<CourierGuyOrderBookingActionState> {
  const session = await requireShippingManageAccess();
  const parsed = bookingActionSchema.safeParse({
    batchId: String(formData.get("batchId") ?? ""),
    orderId: String(formData.get("orderId") ?? ""),
  });

  if (!parsed.success) {
    return {
      message: "The reviewed quote is invalid. Request fresh live quotes.",
      ok: false,
      result: null,
    };
  }

  try {
    const result = await confirmCourierGuyOrderBooking({
      actorUserId: session.user.id,
      batchId: parsed.data.batchId,
      orderId: parsed.data.orderId,
    });
    revalidatePackingPages(parsed.data.orderId);
    const everyPackageBooked = result.results.every(
      (booking) => booking.status === "booked",
    );

    return {
      message: everyPackageBooked
        ? "Every package was booked successfully."
        : "Courier Guy returned a mixed booking result. Review every package below before retrying.",
      ok: everyPackageBooked,
      result,
    };
  } catch (error) {
    revalidatePackingPages(parsed.data.orderId);

    return {
      message: errorMessage(
        error,
        "The Courier Guy packages could not be booked.",
      ),
      ok: false,
      result: null,
    };
  }
}
