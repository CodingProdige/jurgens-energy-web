export type GoogleMerchantDestination =
  | "Free_listings"
  | "Free_local_listings"
  | "Local_inventory_ads"
  | "Shopping_ads";

export type GoogleMerchantDestinationControls = {
  excluded: GoogleMerchantDestination[];
  included: GoogleMerchantDestination[];
};

export function getGoogleMerchantDestinationControls(
  channel: "local_lpg" | "national_courier",
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
