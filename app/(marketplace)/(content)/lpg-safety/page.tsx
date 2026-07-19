import type { Metadata } from "next";

import { LpgSafetyPage } from "@/src/modules/marketplace/content/lpg-safety-page";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("lpg-safety");
}

export default function LpgSafetyRoute() {
  return <LpgSafetyPage />;
}
