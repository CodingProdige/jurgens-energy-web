import type { Metadata } from "next";

import {
  createFaqStructuredDataItems,
  FaqPage,
} from "@/src/modules/marketplace/content/faq-page";
import {
  getPublicDeliveryFeeDescription,
  getPublicDeliveryTimingDescription,
} from "@/src/modules/marketplace/public-delivery-copy";
import { getPublicReturnsFaqAnswer } from "@/src/modules/marketplace/public-returns-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";
import {
  createBreadcrumbStructuredData,
  createFaqStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("faq");
}

export default async function FaqRoute() {
  const settings = await getMarketplaceSettings();
  const deliveryFeeDescription = getPublicDeliveryFeeDescription(settings);
  const deliveryTimingDescription =
    getPublicDeliveryTimingDescription(settings);
  const returnsAnswer = getPublicReturnsFaqAnswer(settings);

  return (
    <>
      <MarketplaceJsonLd
        data={[
          createFaqStructuredData(
            createFaqStructuredDataItems(
              deliveryFeeDescription,
              deliveryTimingDescription,
              returnsAnswer,
            ),
          ),
          createBreadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Frequently asked questions", path: "/faq" },
          ]),
        ]}
      />
      <FaqPage
        deliveryFeeDescription={deliveryFeeDescription}
        deliveryTimingDescription={deliveryTimingDescription}
        returnsAnswer={returnsAnswer}
      />
    </>
  );
}
