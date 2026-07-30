export type GoogleMerchantDestination =
  | "Free_listings"
  | "Free_local_listings"
  | "Local_inventory_ads"
  | "Shopping_ads";

export type GoogleMerchantDestinationControls = {
  excluded: GoogleMerchantDestination[];
  included: GoogleMerchantDestination[];
};

export type GoogleMerchantShippingLabel = "local_lpg" | "national_courier";

export type GoogleMerchantFulfillmentChannel =
  | GoogleMerchantShippingLabel
  | "excluded"
  | null;

export type GoogleMerchantFulfillmentMode =
  | "jurgens_fulfilled"
  | "seller_fulfilled";

export type GoogleMerchantDeliveryConfiguration = {
  courierGuyDropoffPickupPointId: string | null;
  courierGuyEnabled: boolean;
  courierGuyLiveAccountCode: string | null;
  courierGuyMode: "live" | "sandbox";
  courierGuySandboxAccountCode: string | null;
  hasCourierGuyLiveApiKey: boolean;
  hasCourierGuySandboxApiKey: boolean;
  shippingEnabled: boolean;
};

export function getGoogleMerchantCustomLabel0(
  channel: GoogleMerchantShippingLabel,
): GoogleMerchantShippingLabel {
  return channel;
}

export function getGoogleMerchantShippingLabel(
  channel: GoogleMerchantFulfillmentChannel,
  fulfillmentMode: GoogleMerchantFulfillmentMode,
): GoogleMerchantShippingLabel | null {
  if (channel === "excluded") {
    return null;
  }

  if (fulfillmentMode === "jurgens_fulfilled" || channel === "local_lpg") {
    return "local_lpg";
  }

  return "national_courier";
}

export function getGoogleMerchantDestinationControls(
  channel: GoogleMerchantShippingLabel,
): GoogleMerchantDestinationControls {
  switch (channel) {
    case "local_lpg":
      return {
        excluded: [
          "Shopping_ads",
          "Free_listings",
          "Local_inventory_ads",
          "Free_local_listings",
        ],
        included: [],
      };
    case "national_courier":
      return {
        excluded: ["Local_inventory_ads", "Free_local_listings"],
        included: ["Shopping_ads", "Free_listings"],
      };
  }
}

/**
 * Postcode-limited Jurgens offers stay in the feed with every destination
 * excluded. A nationwide offer is publishable only while checkout delivery
 * and the active Courier Guy environment are both usable.
 */
export function shouldPublishGoogleMerchantOffer(
  channel: GoogleMerchantShippingLabel,
  configuration: GoogleMerchantDeliveryConfiguration,
) {
  if (channel === "local_lpg") {
    return true;
  }

  if (configuration.courierGuyMode !== "live") {
    return false;
  }

  return Boolean(
    configuration.shippingEnabled &&
      configuration.courierGuyEnabled &&
      configuration.courierGuyLiveAccountCode?.trim() &&
      configuration.hasCourierGuyLiveApiKey &&
      configuration.courierGuyDropoffPickupPointId?.trim(),
  );
}
