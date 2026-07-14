import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { termsAndConditions } from "@/src/modules/marketplace/policies/documents";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Review the terms for using the Jurgens Energy store, placing orders, making payments, receiving deliveries, and exchanging LPG cylinders.",
};

export default function TermsAndConditionsPage() {
  return <PolicyPage document={termsAndConditions} />;
}
