import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { privacyPolicy } from "@/src/modules/marketplace/policies/documents";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how Jurgens Energy collects, uses, protects, and shares personal information across orders, delivery, accounts, and WhatsApp support.",
};

export default function PrivacyPolicyPage() {
  return <PolicyPage document={privacyPolicy} />;
}
