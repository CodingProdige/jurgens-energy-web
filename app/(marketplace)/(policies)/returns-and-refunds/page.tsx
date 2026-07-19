import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { returnsAndRefundsPolicy } from "@/src/modules/marketplace/policies/documents";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("returns-and-refunds");
}

export default function ReturnsAndRefundsPage() {
  return <PolicyPage document={returnsAndRefundsPolicy} />;
}
