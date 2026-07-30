export const courierGuyCustomerMilestones = [
  "booked",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_exception",
  "returned",
  "undeliverable",
  "cancelled",
] as const;

export type CourierGuyCustomerMilestone =
  (typeof courierGuyCustomerMilestones)[number];

const milestoneByShipmentStatus: Record<
  string,
  CourierGuyCustomerMilestone | null
> = {
  booked: "booked",
  booking: null,
  cancelled: "cancelled",
  cancelling: null,
  collected: "collected",
  delivered: "delivered",
  failed_delivery: "delivery_exception",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  pending_booking: null,
  ready_for_collection: "in_transit",
  returned: "returned",
  undeliverable: "undeliverable",
  waybill_ready: "booked",
};

const milestoneLabels: Record<CourierGuyCustomerMilestone, string> = {
  booked: "Booked with The Courier Guy",
  cancelled: "Cancelled",
  collected: "Accepted by The Courier Guy",
  delivered: "Delivered",
  delivery_exception: "Delivery attempt needs attention",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  returned: "Returning to sender",
  undeliverable: "Unable to deliver",
};

export function resolveCourierGuyCustomerMilestone(
  shipmentStatus: string,
): CourierGuyCustomerMilestone | null {
  return milestoneByShipmentStatus[shipmentStatus] ?? null;
}

export function getCourierGuyCustomerMilestoneLabel(
  milestone: CourierGuyCustomerMilestone,
) {
  return milestoneLabels[milestone];
}
