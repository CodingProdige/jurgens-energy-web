import type { Metadata } from "next";

import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { createPrivacyPolicyDocument } from "@/src/modules/marketplace/policies/documents";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";
import { MarketplaceBusinessJsonLd } from "@/src/modules/marketplace/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("privacy-policy");
}

export default async function PrivacyPolicyPage() {
  const businessIdentity = await getPublicBusinessIdentity();

  return (
    <>
      <MarketplaceBusinessJsonLd />
      <PolicyPage
        businessIdentity={businessIdentity}
        document={createPrivacyPolicyDocument(businessIdentity)}
      />
    </>
  );
}
