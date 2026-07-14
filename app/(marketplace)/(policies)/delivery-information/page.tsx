import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { deliveryInformation } from "@/src/modules/marketplace/policies/documents";

export const metadata: Metadata = {
  title: "Delivery Information",
  description:
    "Learn how Jurgens Energy confirms delivery coverage, fees, timing, LPG handovers, cylinder exchanges, and unsuccessful deliveries.",
};

export default function DeliveryInformationPage() {
  return <PolicyPage document={deliveryInformation} />;
}
