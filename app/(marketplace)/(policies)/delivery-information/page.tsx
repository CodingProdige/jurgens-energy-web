import type { Metadata } from "next";

import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { createDeliveryInformationDocument } from "@/src/modules/marketplace/policies/documents";
import { getPublicDeliveryFeeDescription } from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("delivery-information");
}

export default async function DeliveryInformationPage() {
  const [businessIdentity, settings] = await Promise.all([
    getPublicBusinessIdentity(),
    getMarketplaceSettings(),
  ]);

  return (
    <PolicyPage
      businessIdentity={businessIdentity}
      document={createDeliveryInformationDocument(
        getPublicDeliveryFeeDescription(settings),
      )}
    />
  );
}
