import type { Metadata } from "next";

import { FaqPage } from "@/src/modules/marketplace/content/faq-page";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common Jurgens Energy questions about LPG ordering, delivery, cylinder exchanges, product safety, payments, returns and support.",
};

export default function FaqRoute() {
  return <FaqPage />;
}
