import type { MarketplaceSettings } from "./settings.ts";
import { roundMoney } from "../shipping/customer-shipping-policy.ts";

type PublicShippingSettings = Pick<
  MarketplaceSettings,
  "shippingEnabled" | "shippingFlatRate" | "shippingFreeOverAmount"
>;

type PublicDeliveryTimingSettings = Pick<
  MarketplaceSettings,
  | "shippingHandlingMaxBusinessDays"
  | "shippingHandlingMinBusinessDays"
  | "shippingTransitMaxBusinessDays"
  | "shippingTransitMinBusinessDays"
>;

export const publicDeliveryTiming = {
  handlingMaxBusinessDays: 1,
  handlingMinBusinessDays: 0,
  totalMaxBusinessDays: 4,
  totalMinBusinessDays: 1,
  transitMaxBusinessDays: 3,
  transitMinBusinessDays: 1,
} as const;

export const publicDeliveryTimingDescription =
  `Delivery normally takes ${formatPublicBusinessDayRange(publicDeliveryTiming.totalMinBusinessDays, publicDeliveryTiming.totalMaxBusinessDays)} after payment confirmation.`;

export const publicProductDeliveryTimingLabel =
  formatPublicBusinessDayRange(
    publicDeliveryTiming.totalMinBusinessDays,
    publicDeliveryTiming.totalMaxBusinessDays,
  );

export function getPublicDeliveryTiming(
  settings: PublicDeliveryTimingSettings,
) {
  const handlingMinBusinessDays = normalizeBusinessDays(
    settings.shippingHandlingMinBusinessDays,
    publicDeliveryTiming.handlingMinBusinessDays,
  );
  const handlingMaxBusinessDays = Math.max(
    handlingMinBusinessDays,
    normalizeBusinessDays(
      settings.shippingHandlingMaxBusinessDays,
      publicDeliveryTiming.handlingMaxBusinessDays,
    ),
  );
  const transitMinBusinessDays = normalizeBusinessDays(
    settings.shippingTransitMinBusinessDays,
    publicDeliveryTiming.transitMinBusinessDays,
  );
  const transitMaxBusinessDays = Math.max(
    transitMinBusinessDays,
    normalizeBusinessDays(
      settings.shippingTransitMaxBusinessDays,
      publicDeliveryTiming.transitMaxBusinessDays,
    ),
  );

  return {
    handlingMaxBusinessDays,
    handlingMinBusinessDays,
    totalMaxBusinessDays:
      handlingMaxBusinessDays + transitMaxBusinessDays,
    totalMinBusinessDays:
      handlingMinBusinessDays + transitMinBusinessDays,
    transitMaxBusinessDays,
    transitMinBusinessDays,
  };
}

export function getPublicDeliveryTimingDescription(
  settings: PublicDeliveryTimingSettings,
) {
  const timing = getPublicDeliveryTiming(settings);

  return `Delivery normally takes ${formatPublicBusinessDayRange(
    timing.totalMinBusinessDays,
    timing.totalMaxBusinessDays,
  )} after payment confirmation.`;
}

export function getPublicProductDeliveryTimingLabel(
  settings: PublicDeliveryTimingSettings,
) {
  const timing = getPublicDeliveryTiming(settings);

  return formatPublicBusinessDayRange(
    timing.totalMinBusinessDays,
    timing.totalMaxBusinessDays,
  );
}

export function formatPublicBusinessDayRange(minimum: number, maximum: number) {
  if (minimum === maximum) {
    return `${minimum} business ${minimum === 1 ? "day" : "days"}`;
  }

  return `${minimum}–${maximum} business days`;
}

export function getPublicProductDeliveryCopy(input: {
  fulfillmentMode: "jurgens_fulfilled" | "seller_fulfilled";
  shippingEnabled: boolean;
} & PublicDeliveryTimingSettings) {
  if (!input.shippingEnabled) {
    return {
      available: false,
      benefit: "Online delivery is currently unavailable",
      detail: "Delivery currently unavailable",
      label: "Online delivery unavailable",
    };
  }

  const timing = getPublicDeliveryTiming(input);
  const timingLabel = formatPublicBusinessDayRange(
    timing.totalMinBusinessDays,
    timing.totalMaxBusinessDays,
  );

  return {
    available: true,
    benefit: `Usually arrives within ${timingLabel}`,
    detail: timingLabel,
    label:
      input.fulfillmentMode === "jurgens_fulfilled"
        ? "Jurgens delivery areas"
        : "Nationwide delivery",
  };
}

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

function normalizeBusinessDays(value: number, fallback: number) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
