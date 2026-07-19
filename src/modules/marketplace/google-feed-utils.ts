export type GoogleLocalInventoryAvailability =
  | "in_stock"
  | "limited_availability"
  | "out_of_stock";

export type GoogleMerchantDestination =
  | "Free_listings"
  | "Free_local_listings"
  | "Local_inventory_ads"
  | "Shopping_ads";

export type GoogleMerchantDestinationControls = {
  excluded: GoogleMerchantDestination[];
  included: GoogleMerchantDestination[];
};

const googleLocalInventoryStoreCodePattern = /^[A-Za-z0-9_-]{1,100}$/;

export function normalizeGoogleLocalInventoryStoreCode(
  value: string | null | undefined,
) {
  const storeCode = value?.trim() ?? "";

  return googleLocalInventoryStoreCodePattern.test(storeCode)
    ? storeCode
    : null;
}

export function getGoogleLocalInventoryAvailability(
  stockOnHand: number,
): GoogleLocalInventoryAvailability {
  if (stockOnHand >= 3) {
    return "in_stock";
  }

  if (stockOnHand >= 1) {
    return "limited_availability";
  }

  return "out_of_stock";
}

export function getGoogleMerchantDestinationControls(
  channel: "local_lpg" | "national_courier",
): GoogleMerchantDestinationControls {
  if (channel === "local_lpg") {
    return {
      excluded: ["Shopping_ads", "Free_listings"],
      included: ["Free_local_listings", "Local_inventory_ads"],
    };
  }

  return {
    excluded: ["Local_inventory_ads", "Free_local_listings"],
    included: ["Shopping_ads", "Free_listings"],
  };
}
