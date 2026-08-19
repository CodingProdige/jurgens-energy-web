import type { Metadata } from "next";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { MarketplaceDeliveryWindowProvider } from "@/components/marketplace/marketplace-delivery-window-provider";
import { getCheckoutAddressBook } from "@/src/modules/marketplace/account/addresses";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettings();

  if (!settings.googleSiteVerificationToken) {
    return {};
  }

  return {
    verification: {
      google: settings.googleSiteVerificationToken,
    },
  };
}

export default async function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  return (
    <MarketplaceLayoutContent userId={session?.user?.id ?? null}>
      {children}
    </MarketplaceLayoutContent>
  );
}

async function MarketplaceLayoutContent({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const defaultAddressBook = userId
    ? await getCheckoutAddressBook(userId)
    : null;
  const defaultAddress = defaultAddressBook?.defaultAddress;
  const defaultDeliveryAddress = defaultAddress
    ? {
        addressLine1: defaultAddress.addressLine1,
        addressLine2: defaultAddress.addressLine2 ?? "",
        city: defaultAddress.city,
        countryCode: defaultAddress.countryCode,
        postalCode: defaultAddress.postalCode,
        province: defaultAddress.province,
        suburb: defaultAddress.suburb,
      }
    : null;

  return (
    <MarketplaceDeliveryWindowProvider
      defaultDeliveryAddress={defaultDeliveryAddress}
    >
      {children}
    </MarketplaceDeliveryWindowProvider>
  );
}
