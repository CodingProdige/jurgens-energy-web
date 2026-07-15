import type { Metadata } from "next";

import { ContactPage } from "@/src/modules/marketplace/content/contact-page";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Jurgens Energy by WhatsApp, telephone or email for help with LPG products, cylinder exchanges, delivery and existing orders.",
};

export default function ContactRoute() {
  return <ContactPage />;
}
