"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  jurgensDeliveryScheduleStatuses,
  jurgensDeliverySchedules,
  orders,
  shipments,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { sendJurgensDeliveryStatusNotification } from "@/src/modules/orders/jurgens-delivery-notifications";

const statusSchema = z.object({
  scheduleId: z.string().trim().uuid(),
  status: z.enum(jurgensDeliveryScheduleStatuses),
});

function toShipmentStatus(status: JurgensDeliveryScheduleStatus) {
  if (status === "preparing") {
    return "booked";
  }

  if (status === "out_for_delivery") {
    return "out_for_delivery";
  }

  if (status === "completed") {
    return "delivered";
  }

  if (status === "missed") {
    return "failed_delivery";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "pending_booking";
}

export async function updateScheduledDeliveryStatusAction(formData: FormData) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to update scheduled orders.");
  }

  const parsed = statusSchema.safeParse({
    scheduleId: String(formData.get("scheduleId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Choose a valid delivery status.",
    );
  }

  const now = new Date();
  const changed = await db.transaction(async (tx) => {
    const [schedule] = await tx
      .select({
        orderId: jurgensDeliverySchedules.orderId,
        shipmentId: jurgensDeliverySchedules.shipmentId,
        status: jurgensDeliverySchedules.status,
      })
      .from(jurgensDeliverySchedules)
      .where(eq(jurgensDeliverySchedules.id, parsed.data.scheduleId))
      .limit(1);

    if (!schedule) {
      throw new Error("Scheduled delivery could not be found.");
    }

    await tx
      .update(jurgensDeliverySchedules)
      .set({ status: parsed.data.status, updatedAt: now })
      .where(eq(jurgensDeliverySchedules.id, parsed.data.scheduleId));

    if (schedule.shipmentId) {
      await tx
        .update(shipments)
        .set({
          status: toShipmentStatus(parsed.data.status),
          updatedAt: now,
          ...(parsed.data.status === "completed" ? { deliveredAt: now } : {}),
        })
        .where(eq(shipments.id, schedule.shipmentId));
    }

    if (parsed.data.status === "completed") {
      await tx
        .update(orders)
        .set({ status: "fulfilled", updatedAt: now })
        .where(eq(orders.id, schedule.orderId));
    }

    return schedule.status !== parsed.data.status;
  });

  if (changed) {
    await sendJurgensDeliveryStatusNotification({
      scheduleId: parsed.data.scheduleId,
    }).catch(() => null);
  }

  revalidatePath("/orders");
  revalidatePath("/orders/scheduled");
}
