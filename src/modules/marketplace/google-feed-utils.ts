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

export function getGoogleMerchantCustomLabel0(
  channel: GoogleMerchantShippingLabel,
): GoogleMerchantShippingLabel {
  return channel;
}

export function getGoogleMerchantDestinationControls(
  channel: GoogleMerchantShippingLabel,
): GoogleMerchantDestinationControls {
  switch (channel) {
    case "local_lpg":
    case "national_courier":
      return {
        excluded: ["Local_inventory_ads", "Free_local_listings"],
        included: ["Shopping_ads", "Free_listings"],
      };
  }
}
