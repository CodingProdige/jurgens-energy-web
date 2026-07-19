import type { Metadata } from "next";

import {
  faqStructuredDataItems,
  FaqPage,
} from "@/src/modules/marketplace/content/faq-page";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";
import {
  createBreadcrumbStructuredData,
  createFaqStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("faq");
}

export default function FaqRoute() {
  return (
    <>
      <MarketplaceJsonLd
        data={[
          createFaqStructuredData([...faqStructuredDataItems]),
          createBreadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Frequently asked questions", path: "/faq" },
          ]),
        ]}
      />
      <FaqPage />
    </>
  );
}
