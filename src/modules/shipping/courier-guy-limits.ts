export const MAX_COURIER_GUY_UNITS_PER_ORDER = 20;

export function countCourierGuyUnits(
  items: Array<{
    fulfillmentMode: "seller_fulfilled" | "jurgens_fulfilled";
    quantity: number;
  }>,
) {
  return items.reduce(
    (total, item) =>
      item.fulfillmentMode === "seller_fulfilled"
        ? total + item.quantity
        : total,
    0,
  );
}
