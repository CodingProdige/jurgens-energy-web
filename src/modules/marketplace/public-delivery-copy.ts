import type { MarketplaceSettings } from "@/src/modules/marketplace/settings";
import { roundMoney } from "@/src/modules/shipping/customer-shipping-policy";

type PublicShippingSettings = Pick<
  MarketplaceSettings,
  "shippingEnabled" | "shippingFlatRate" | "shippingFreeOverAmount"
>;

export const publicDeliveryTimingDescription =
  "Handling normally takes 0–1 business day after payment confirmation. Transit time depends on the destination, parcel and delivery service. Any available delivery estimate is communicated in the order updates or tracking details.";

export function getPublicDeliveryFeeDescription(
  settings: PublicShippingSettings,
) {
  if (!settings.shippingEnabled) {
    return "Online delivery is currently unavailable. The applicable delivery fee will be shown before payment when delivery is available again.";
  }

  const flatRate = roundMoney(Math.max(0, settings.shippingFlatRate));
  const freeOverAmount =
    settings.shippingFreeOverAmount === null
      ? null
      : roundMoney(Math.max(0, settings.shippingFreeOverAmount));

  if (flatRate === 0) {
    return "Standard delivery is currently free for eligible orders.";
  }

  const flatRateCopy = formatZar(flatRate);

  if (freeOverAmount !== null && freeOverAmount > 0) {
    return `The current VAT-inclusive standard delivery fee is ${flatRateCopy} per eligible order. Delivery is free when the qualifying product subtotal reaches ${formatZar(freeOverAmount)}.`;
  }

  return `The current VAT-inclusive standard delivery fee is ${flatRateCopy} per eligible order.`;
}

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
