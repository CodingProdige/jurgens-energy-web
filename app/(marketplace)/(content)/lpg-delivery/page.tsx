import type { Metadata } from "next";

import { LocalDeliveryPage } from "@/src/modules/marketplace/content/local-delivery-page";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("lpg-delivery");
}

export default function LocalDeliveryRoute() {
  return <LocalDeliveryPage />;
}
