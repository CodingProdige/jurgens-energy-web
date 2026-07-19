import type { Metadata } from "next";

import { AboutPage } from "@/src/modules/marketplace/content/about-page";
import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("about");
}

export default async function AboutRoute() {
  const businessIdentity = await getPublicBusinessIdentity();

  return <AboutPage businessIdentity={businessIdentity} />;
}
