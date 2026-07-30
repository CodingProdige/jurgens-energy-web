"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { jurgensDeliveryScheduleStatuses } from "@/src/db/schema";
import {
  retryJurgensDeliveryNotification,
  saveJurgensDeliveryPlan,
  updateJurgensDeliveryStatus,
} from "@/src/modules/admin/jurgens-local-delivery-service";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type ScheduledDeliveryActionState = {
  message: string;
  ok: boolean;
};

const optionalText = (maximumLength: number) =>
  z.preprocess(
    (value) => String(value ?? "").trim() || null,
    z.string().max(maximumLength).nullable(),
  );
const scheduleIdSchema = z.object({
  scheduleId: z.string().trim().uuid(),
});
const statusSchema = scheduleIdSchema.extend({
  status: z.enum(jurgensDeliveryScheduleStatuses),
});
const deliveryPlanSchema = z
  .object({
    deliveryInstructions: optionalText(2_000),
    scheduledDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid delivery date."),
    shipmentId: z.string().trim().uuid(),
    windowEnd: optionalText(5),
    windowLabel: optionalText(80),
    windowStart: optionalText(5),
  })
  .superRefine((value, context) => {
    const date = new Date(`${value.scheduledDate}T00:00:00+02:00`);
    const validCalendarDate =
      !Number.isNaN(date.getTime()) &&
      date.toLocaleDateString("en-CA", {
        timeZone: "Africa/Johannesburg",
      }) === value.scheduledDate;

    if (!validCalendarDate) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid delivery date.",
        path: ["scheduledDate"],
      });
    }

    if (value.scheduledDate < todayInJohannesburg()) {
      context.addIssue({
        code: "custom",
        message: "The delivery date cannot be in the past.",
        path: ["scheduledDate"],
      });
    }

    const hasStart = Boolean(value.windowStart);
    const hasEnd = Boolean(value.windowEnd);

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        message: "Enter both a window start and end time, or leave both blank.",
        path: hasStart ? ["windowEnd"] : ["windowStart"],
      });
      return;
    }

    if (!hasStart || !hasEnd) {
      return;
    }

    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timePattern.test(value.windowStart!)) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid start time.",
        path: ["windowStart"],
      });
    }

    if (!timePattern.test(value.windowEnd!)) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid end time.",
        path: ["windowEnd"],
      });
    }

    if (
      timePattern.test(value.windowStart!) &&
      timePattern.test(value.windowEnd!) &&
      value.windowStart! >= value.windowEnd!
    ) {
      context.addIssue({
        code: "custom",
        message: "The delivery window must end after it starts.",
        path: ["windowEnd"],
      });
    }
  });

function todayInJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(new Date());
}

async function requireScheduledOrderManageAccess() {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage local deliveries.");
  }

  return access.session;
}

function revalidateLocalDeliverySurfaces() {
  revalidatePath("/orders");
  revalidatePath("/orders/scheduled");
  revalidatePath("/shipping");
}

function errorState(error: unknown, fallback: string): ScheduledDeliveryActionState {
  return {
    message: error instanceof Error ? error.message : fallback,
    ok: false,
  };
}

export async function saveScheduledDeliveryPlanAction(
  _state: ScheduledDeliveryActionState,
  formData: FormData,
): Promise<ScheduledDeliveryActionState> {
  let session: Awaited<ReturnType<typeof requireScheduledOrderManageAccess>>;

  try {
    session = await requireScheduledOrderManageAccess();
  } catch (error) {
    return errorState(error, "You do not have permission to manage deliveries.");
  }

  const parsed = deliveryPlanSchema.safeParse({
    deliveryInstructions: formData.get("deliveryInstructions"),
    scheduledDate: String(formData.get("scheduledDate") ?? ""),
    shipmentId: String(formData.get("shipmentId") ?? ""),
    windowEnd: formData.get("windowEnd"),
    windowLabel: formData.get("windowLabel"),
    windowStart: formData.get("windowStart"),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "Review the local delivery plan and try again.",
      ok: false,
    };
  }

  try {
    const hasWindow = Boolean(
      parsed.data.windowStart && parsed.data.windowEnd,
    );
    const result = await saveJurgensDeliveryPlan({
      ...parsed.data,
      actorUserId: session.user.id,
      windowEnd: hasWindow ? parsed.data.windowEnd : null,
      windowLabel: hasWindow
        ? (parsed.data.windowLabel ?? "Delivery window")
        : null,
      windowStart: hasWindow ? parsed.data.windowStart : null,
    });

    revalidateLocalDeliverySurfaces();

    if (!result.changed) {
      return { message: "No delivery-plan changes were needed.", ok: true };
    }

    return {
      message: result.notification?.delivered
        ? `Delivery ${result.status === "scheduled" ? "scheduled" : "plan updated"}. ${result.notification.message}`
        : `Delivery ${result.status === "scheduled" ? "scheduled" : "plan updated"}. ${result.notification?.message ?? ""}`.trim(),
      ok: true,
    };
  } catch (error) {
    return errorState(error, "The delivery plan could not be saved.");
  }
}

export async function updateScheduledDeliveryStatusAction(
  _state: ScheduledDeliveryActionState,
  formData: FormData,
): Promise<ScheduledDeliveryActionState> {
  let session: Awaited<ReturnType<typeof requireScheduledOrderManageAccess>>;

  try {
    session = await requireScheduledOrderManageAccess();
  } catch (error) {
    return errorState(error, "You do not have permission to manage deliveries.");
  }

  const parsed = statusSchema.safeParse({
    scheduleId: String(formData.get("scheduleId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ?? "Choose a valid delivery status.",
      ok: false,
    };
  }

  try {
    const result = await updateJurgensDeliveryStatus({
      actorUserId: session.user.id,
      scheduleId: parsed.data.scheduleId,
      status: parsed.data.status,
    });

    revalidateLocalDeliverySurfaces();

    return {
      message: `Delivery marked ${result.status.replaceAll("_", " ")}. ${result.notification.message}`,
      ok: true,
    };
  } catch (error) {
    return errorState(error, "The delivery status could not be updated.");
  }
}

export async function retryScheduledDeliveryNotificationAction(
  _state: ScheduledDeliveryActionState,
  formData: FormData,
): Promise<ScheduledDeliveryActionState> {
  let session: Awaited<ReturnType<typeof requireScheduledOrderManageAccess>>;

  try {
    session = await requireScheduledOrderManageAccess();
  } catch (error) {
    return errorState(error, "You do not have permission to manage deliveries.");
  }

  const parsed = scheduleIdSchema.safeParse({
    scheduleId: String(formData.get("scheduleId") ?? ""),
  });

  if (!parsed.success) {
    return { message: "Choose a valid local delivery.", ok: false };
  }

  try {
    const result = await retryJurgensDeliveryNotification({
      actorUserId: session.user.id,
      scheduleId: parsed.data.scheduleId,
    });

    revalidatePath("/orders/scheduled");

    return {
      message: result.message,
      ok: result.delivered,
    };
  } catch (error) {
    return errorState(error, "The customer update could not be retried.");
  }
}
