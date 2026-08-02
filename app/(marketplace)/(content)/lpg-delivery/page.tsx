import type { Metadata } from "next";

import { LocalDeliveryPage } from "@/src/modules/marketplace/content/local-delivery-page";
import { getPublicDeliveryTimingDescription } from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettings();

  return getStaticPageMetadata("lpg-delivery", {
    description: `Shop online for nationwide delivery across South Africa. ${getPublicDeliveryTimingDescription(settings)} Checkout shows delivery timing and fees before payment.`,
  });
}

export default function LocalDeliveryRoute() {
  return <LocalDeliveryPage />;
}
