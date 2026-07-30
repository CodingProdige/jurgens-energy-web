import type { JurgensDeliveryScheduleStatus } from "@/src/db/schema";

export type JurgensLocalShipmentMilestones = {
  bookedAt: Date | null;
  collectedAt: Date | null;
  deliveredAt: Date | null;
};

export type JurgensLocalShipmentUpdate = JurgensLocalShipmentMilestones & {
  status:
    | "booked"
    | "cancelled"
    | "delivered"
    | "failed_delivery"
    | "out_for_delivery"
    | "pending_booking";
};

const allowedStatusTransitions: Record<
  JurgensDeliveryScheduleStatus,
  readonly JurgensDeliveryScheduleStatus[]
> = {
  cancelled: [],
  completed: [],
  missed: ["rescheduled", "cancelled"],
  out_for_delivery: ["completed", "missed"],
  preparing: ["out_for_delivery", "rescheduled", "cancelled"],
  rescheduled: ["preparing", "cancelled"],
  scheduled: ["preparing", "rescheduled", "cancelled"],
};

export function getAllowedJurgensDeliveryStatusTransitions(
  status: JurgensDeliveryScheduleStatus,
) {
  return allowedStatusTransitions[status];
}

export function canTransitionJurgensDeliveryStatus({
  from,
  to,
}: {
  from: JurgensDeliveryScheduleStatus;
  to: JurgensDeliveryScheduleStatus;
}) {
  return allowedStatusTransitions[from].includes(to);
}

export function canEditJurgensDeliveryPlan(
  status: JurgensDeliveryScheduleStatus,
) {
  return ["missed", "preparing", "rescheduled", "scheduled"].includes(status);
}

export function getJurgensLocalShipmentUpdate({
  current,
  now,
  status,
}: {
  current: JurgensLocalShipmentMilestones;
  now: Date;
  status: JurgensDeliveryScheduleStatus;
}): JurgensLocalShipmentUpdate {
  if (status === "scheduled" || status === "rescheduled") {
    return {
      bookedAt: null,
      collectedAt: null,
      deliveredAt: null,
      status: "pending_booking",
    };
  }

  if (status === "preparing") {
    return {
      bookedAt: current.bookedAt ?? now,
      collectedAt: null,
      deliveredAt: null,
      status: "booked",
    };
  }

  if (status === "out_for_delivery") {
    return {
      bookedAt: current.bookedAt ?? now,
      collectedAt: current.collectedAt ?? now,
      deliveredAt: null,
      status: "out_for_delivery",
    };
  }

  if (status === "completed") {
    return {
      bookedAt: current.bookedAt ?? now,
      collectedAt: current.collectedAt ?? now,
      deliveredAt: current.deliveredAt ?? now,
      status: "delivered",
    };
  }

  if (status === "missed") {
    return {
      bookedAt: current.bookedAt ?? now,
      collectedAt: current.collectedAt ?? now,
      deliveredAt: null,
      status: "failed_delivery",
    };
  }

  return {
    bookedAt: current.bookedAt,
    collectedAt: current.collectedAt,
    deliveredAt: null,
    status: "cancelled",
  };
}
