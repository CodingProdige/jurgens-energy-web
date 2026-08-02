import type { Metadata } from "next";

import { SupportPage } from "@/src/modules/marketplace/content/support-page";
import { MarketplaceBusinessJsonLd } from "@/src/modules/marketplace/structured-data";

export const metadata: Metadata = {
  description:
    "Get help from Jurgens Energy with products, online orders, payments, delivery, returns and account questions.",
  title: "Support",
};

export default function SupportRoute() {
  return (
    <>
      <MarketplaceBusinessJsonLd />
      <SupportPage />
    </>
  );
}
