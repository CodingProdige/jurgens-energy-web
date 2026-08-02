import type { Metadata } from "next";

import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { createReturnsAndRefundsPolicy } from "@/src/modules/marketplace/policies/documents";
import { getPublicReturnsSummary } from "@/src/modules/marketplace/public-returns-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettings();

  return getStaticPageMetadata("returns-and-refunds", {
    description: getPublicReturnsSummary(settings),
  });
}

export default async function ReturnsAndRefundsPage() {
  const [businessIdentity, settings] = await Promise.all([
    getPublicBusinessIdentity(),
    getMarketplaceSettings(),
  ]);

  return (
    <PolicyPage
      businessIdentity={businessIdentity}
      document={createReturnsAndRefundsPolicy(settings)}
    />
  );
}
