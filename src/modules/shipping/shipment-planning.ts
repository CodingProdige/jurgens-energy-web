export type FulfillmentProvider = "courier_guy" | "jurgens_local";

export type ShipmentPlanningItem = {
  deliveryMethod: string | null;
  heightMm: number | null;
  lengthMm: number | null;
  quantity: number;
  sellerId: string | null;
  title: string;
  unitPrice: number;
  variantId: string;
  weightGrams: number | null;
  widthMm: number | null;
};

export type PlannedShipmentParcel = {
  declaredValue: number;
  heightMm: number;
  lengthMm: number;
  referenceSuffix: string;
  weightGrams: number;
  widthMm: number;
};

export type PlannedShipment = {
  parcels: PlannedShipmentParcel[];
  provider: FulfillmentProvider;
  sellerId: string | null;
};

function isFulfillmentProvider(value: string | null): value is FulfillmentProvider {
  return value === "courier_guy" || value === "jurgens_local";
}

/**
 * Customer pricing is deliberately absent from this planner. These plans are
 * operational records created after payment and cannot change the order total.
 */
export function planOrderShipments(
  items: ShipmentPlanningItem[],
): PlannedShipment[] {
  const courierPlansBySeller = new Map<string, PlannedShipment>();
  const jurgensPlan: PlannedShipment = {
    parcels: [],
    provider: "jurgens_local",
    sellerId: null,
  };
  let hasJurgensItems = false;

  items.forEach((item, itemIndex) => {
    if (!isFulfillmentProvider(item.deliveryMethod)) {
      return;
    }

    if (item.deliveryMethod === "courier_guy") {
      const sellerKey = item.sellerId ?? "";

      if (!courierPlansBySeller.has(sellerKey)) {
        courierPlansBySeller.set(sellerKey, {
          parcels: [],
          provider: "courier_guy",
          sellerId: item.sellerId,
        });
      }

      return;
    }

    hasJurgensItems = true;

    const hasMeasurements =
      item.heightMm !== null &&
      item.heightMm > 0 &&
      item.lengthMm !== null &&
      item.lengthMm > 0 &&
      item.weightGrams !== null &&
      item.weightGrams > 0 &&
      item.widthMm !== null &&
      item.widthMm > 0;

    if (hasMeasurements) {
      for (let unitIndex = 0; unitIndex < item.quantity; unitIndex += 1) {
        jurgensPlan.parcels.push({
          declaredValue: roundMoney(item.unitPrice),
          heightMm: item.heightMm!,
          lengthMm: item.lengthMm!,
          referenceSuffix: `${itemIndex + 1}-${unitIndex + 1}`,
          weightGrams: item.weightGrams!,
          widthMm: item.widthMm!,
        });
      }
    }
  });

  return [
    ...(hasJurgensItems ? [jurgensPlan] : []),
    ...Array.from(courierPlansBySeller.values()),
  ];
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
