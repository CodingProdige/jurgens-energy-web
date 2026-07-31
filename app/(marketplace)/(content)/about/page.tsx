import type { Metadata } from "next";

import { AboutPage } from "@/src/modules/marketplace/content/about-page";
import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { getPublicDeliveryTimingDescription } from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("about");
}

export default async function AboutRoute() {
  const [businessIdentity, settings] = await Promise.all([
    getPublicBusinessIdentity(),
    getMarketplaceSettings(),
  ]);

  return (
    <AboutPage
      businessIdentity={businessIdentity}
      deliveryTimingDescription={getPublicDeliveryTimingDescription(settings)}
    />
  );
}
