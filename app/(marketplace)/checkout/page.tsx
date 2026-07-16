import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { auth } from "@/auth";
import { CheckoutExperience } from "@/components/marketplace/checkout-experience";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import type {
  CheckoutAddressPrefill,
  CheckoutSavedAddress,
} from "@/src/modules/checkout/contracts";
import { getLatestOwnedCheckoutAddress } from "@/src/modules/checkout/orders";
import { getCheckoutAddressBook } from "@/src/modules/marketplace/account/addresses";
import {
  getPrimaryWhatsappCustomerLinkForUser,
} from "@/src/modules/whatsapp-ordering/customer-links";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete delivery and payment for your Jurgens Energy order.",
  robots: { follow: false, index: false },
};

export default async function CheckoutPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  let initialAddresses: CheckoutSavedAddress[] = [];
  let initialFallbackAddress: CheckoutAddressPrefill | null = null;
  let initialPhone = "";

  if (userId) {
    const addressBook = await getCheckoutAddressBook(userId);

    initialAddresses = addressBook.addresses.map((address) => ({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? "",
      city: address.city,
      countryCode: address.countryCode,
      id: address.id,
      isDefault: address.isDefault,
      label: address.label,
      postalCode: address.postalCode,
      province: address.province,
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      suburb: address.suburb,
    }));

    if (initialAddresses.length === 0) {
      const [fallbackAddress, whatsappLink] = await Promise.all([
        getLatestOwnedCheckoutAddress(userId),
        getPrimaryWhatsappCustomerLinkForUser(userId),
      ]);

      initialFallbackAddress = fallbackAddress;
      initialPhone = whatsappLink?.phone ?? "";
    }
  }

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip bg-[#f7f7f2] pb-10 dark:bg-[#080808] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))]">
          <div className="mx-auto w-full py-4 sm:px-6 sm:py-7 lg:px-10">
            <header className="px-3 pb-4 sm:px-0 sm:pb-6">
              <nav
                aria-label="Checkout breadcrumbs"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#777770] dark:text-[#aaa9a1] sm:text-xs"
              >
                <Link className="hover:text-[#ff5a1f]" href="/cart">
                  Cart
                </Link>
                <ChevronRightIcon className="size-3.5" />
                <span className="text-[#1a1a1a] dark:text-[#e1e1da]">Checkout</span>
              </nav>
              <h1 className="mt-3 text-[28px] font-black leading-tight sm:text-[38px]">
                Checkout
              </h1>
            </header>
            <CheckoutExperience
              initialAddresses={initialAddresses}
              initialCustomer={{
                email: session?.user?.email ?? "",
                name: session?.user?.name ?? "",
                phone: initialPhone,
              }}
              initialFallbackAddress={initialFallbackAddress}
              isSignedIn={Boolean(userId)}
            />
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
