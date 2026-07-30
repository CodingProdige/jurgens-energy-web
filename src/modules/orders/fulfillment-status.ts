export type AggregatedOrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export function resolveAggregatedOrderStatus({
  orderStatus,
  shipmentStatuses,
}: {
  orderStatus: AggregatedOrderStatus;
  shipmentStatuses: string[];
}): AggregatedOrderStatus {
  if (orderStatus !== "paid" && orderStatus !== "fulfilled") {
    return orderStatus;
  }

  const everyShipmentDelivered =
    shipmentStatuses.length > 0 &&
    shipmentStatuses.every((status) => status === "delivered");

  return everyShipmentDelivered ? "fulfilled" : "paid";
}
