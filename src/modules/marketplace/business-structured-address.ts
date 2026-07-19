import type { PublicRegisteredAddress } from "@/src/modules/business-information";

export type MarketplacePostalAddress = {
  "@type": "PostalAddress";
  addressCountry: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  streetAddress: string;
};

export function createMarketplaceBusinessAddress(
  registeredAddress: PublicRegisteredAddress | null,
  fallbackContactAddress: string | null | undefined,
): MarketplacePostalAddress | string | undefined {
  if (registeredAddress) {
    return {
      "@type": "PostalAddress",
      addressCountry: registeredAddress.countryCode,
      addressLocality: registeredAddress.city,
      addressRegion: registeredAddress.province,
      postalCode: registeredAddress.postalCode,
      streetAddress: [
        registeredAddress.addressLine1,
        registeredAddress.addressLine2,
        registeredAddress.suburb,
      ]
        .filter((value): value is string => Boolean(value))
        .join(", "),
    };
  }

  return fallbackContactAddress?.trim() || undefined;
}
