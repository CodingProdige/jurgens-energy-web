import "server-only";

import type { ValidatedCartItem } from "@/src/modules/cart/contracts";
import type { CheckoutDeliveryAddress } from "@/src/modules/checkout/contracts";
import { getPublicDeliveryTimingDescription } from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  countCourierGuyUnits,
  MAX_COURIER_GUY_UNITS_PER_ORDER,
} from "@/src/modules/shipping/courier-guy-limits";
import {
  checkCourierGuyServiceability,
  type CourierGuyServiceabilityItem,
} from "@/src/modules/shipping/courier-guy-serviceability";
import {
  calculateCustomerShippingPrice,
  type CustomerShippingPrice,
} from "@/src/modules/shipping/customer-shipping-policy";
import { checkJurgensDeliveryAvailability } from "@/src/modules/shipping/jurgens-delivery";

export type CustomerDeliveryEvaluation =
  | {
      eligible: true;
      deliveryInformation: string;
      hasCourierItems: boolean;
      hasJurgensItems: boolean;
      jurgensZoneId: string | null;
      price: CustomerShippingPrice;
    }
  | {
      eligible: false;
      unavailableReason: string;
    };

function courierServiceabilityItems(
  items: ValidatedCartItem[],
): CourierGuyServiceabilityItem[] {
  const courierItems = items.filter(
    (item) => item.fulfillmentMode === "seller_fulfilled",
  );

  return courierItems
    .filter(
      (item) =>
        item.heightMm &&
        item.lengthMm &&
        item.weightGrams &&
        item.widthMm,
    )
    .map((item) => ({
      description: `${item.productTitle} - ${item.variantTitle}`,
      heightMm: item.heightMm!,
      lengthMm: item.lengthMm!,
      weightGrams: item.weightGrams!,
      widthMm: item.widthMm!,
    }));
}

export async function evaluateCustomerDelivery({
  allowCourierGuySandboxCheckout = false,
  deliveryAddress,
  items,
  orderSubtotal,
}: {
  allowCourierGuySandboxCheckout?: boolean;
  deliveryAddress: CheckoutDeliveryAddress;
  items: ValidatedCartItem[];
  orderSubtotal: number;
}): Promise<CustomerDeliveryEvaluation> {
  if (deliveryAddress.countryCode.trim().toUpperCase() !== "ZA") {
    return {
      eligible: false,
      unavailableReason:
        "Delivery is currently available within South Africa only.",
    };
  }

  const settings = await getMarketplaceSettings();
  const isAuthorizedSandboxCheckout =
    settings.courierGuyMode === "sandbox" &&
    allowCourierGuySandboxCheckout;

  if (!settings.shippingEnabled && !isAuthorizedSandboxCheckout) {
    return {
      eligible: false,
      unavailableReason: "Online delivery is temporarily unavailable.",
    };
  }

  const hasCourierItems = items.some(
    (item) => item.fulfillmentMode === "seller_fulfilled",
  );
  const hasJurgensItems = items.some(
    (item) => item.fulfillmentMode === "jurgens_fulfilled",
  );

  if (
    hasCourierItems &&
    settings.courierGuyMode === "sandbox" &&
    !isAuthorizedSandboxCheckout
  ) {
    return {
      eligible: false,
      unavailableReason:
        "Nationwide courier delivery is temporarily unavailable.",
    };
  }

  const courierUnitCount = countCourierGuyUnits(items);

  if (courierUnitCount > MAX_COURIER_GUY_UNITS_PER_ORDER) {
    return {
      eligible: false,
      unavailableReason: `Courier delivery supports up to ${MAX_COURIER_GUY_UNITS_PER_ORDER} parcels per online order. Reduce the courier-product quantities or contact us for a bulk order.`,
    };
  }

  const courierItems = courierServiceabilityItems(items);

  if (courierItems.length) {
    const courierAvailability = await checkCourierGuyServiceability({
      deliveryAddress,
      items: courierItems,
    });

    if (!courierAvailability.eligible) {
      return courierAvailability;
    }
  }

  let jurgensZoneId: string | null = null;

  if (hasJurgensItems) {
    const eligibility = await checkJurgensDeliveryAvailability({
      postalCode: deliveryAddress.postalCode,
    });

    if (!eligibility.eligible) {
      return {
        eligible: false,
        unavailableReason:
          eligibility.unavailableReason ??
          "A Jurgens-delivered item cannot be delivered to this postal code.",
      };
    }

    jurgensZoneId = eligibility.zone.id;
  }

  try {
    return {
      eligible: true,
      deliveryInformation: getPublicDeliveryTimingDescription(settings),
      hasCourierItems,
      hasJurgensItems,
      jurgensZoneId,
      price: calculateCustomerShippingPrice({
        flatRate: settings.shippingFlatRate,
        freeOverAmount: settings.shippingFreeOverAmount,
        orderSubtotal,
      }),
    };
  } catch {
    return {
      eligible: false,
      unavailableReason: "Online delivery is temporarily unavailable.",
    };
  }
}
