import type { Metadata } from "next";

import { ContactPage } from "@/src/modules/marketplace/content/contact-page";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("contact");
}

export default function ContactRoute() {
  return <ContactPage />;
}
