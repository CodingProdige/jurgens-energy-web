import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { privacyPolicy } from "@/src/modules/marketplace/policies/documents";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("privacy-policy");
}

export default function PrivacyPolicyPage() {
  return <PolicyPage document={privacyPolicy} />;
}
