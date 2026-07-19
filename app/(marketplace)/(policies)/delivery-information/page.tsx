import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { deliveryInformation } from "@/src/modules/marketplace/policies/documents";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("delivery-information");
}

export default function DeliveryInformationPage() {
  return <PolicyPage document={deliveryInformation} />;
}
