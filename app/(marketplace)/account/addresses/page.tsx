import type { Metadata } from "next";

import {
  AddressManager,
  type SavedAddressView,
} from "@/app/(marketplace)/account/addresses/address-manager";
import { AccountPageShell } from "@/src/modules/marketplace/account/components";
import { listCustomerAddresses } from "@/src/modules/marketplace/account/addresses";
import { requireCustomerAccount } from "@/src/modules/marketplace/account/data";

export const metadata: Metadata = {
  title: "Saved Addresses",
  description: "Manage the delivery addresses saved to your Jurgens Energy account.",
  robots: { follow: false, index: false },
};

export default async function AccountAddressesPage() {
  const account = await requireCustomerAccount();
  const addresses = await listCustomerAddresses(account.id);
  const addressViews: SavedAddressView[] = addresses.map((address) => ({
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
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

  return (
    <AccountPageShell
      active="addresses"
      description="Save delivery details once, keep them up to date, and choose which address should be used by default."
      title="Saved addresses"
    >
      <AddressManager
        addresses={addressViews}
        defaultRecipientName={account.name ?? ""}
      />
    </AccountPageShell>
  );
}
