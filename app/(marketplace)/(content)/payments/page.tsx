import type { Metadata } from "next";

import { PaymentsPage } from "@/src/modules/marketplace/content/payments-page";
import { MarketplaceBusinessJsonLd } from "@/src/modules/marketplace/structured-data";

export const metadata: Metadata = {
  description:
    "Learn how secure online payments work at Jurgens Energy, including PayFast hosted checkout, clear totals and invoices.",
  title: "Payments",
};

export default function PaymentsRoute() {
  return (
    <>
      <MarketplaceBusinessJsonLd />
      <PaymentsPage />
    </>
  );
}
