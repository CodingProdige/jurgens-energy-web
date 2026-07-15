import type { Metadata } from "next";

import { AboutPage } from "@/src/modules/marketplace/content/about-page";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Meet Jurgens Energy and learn how we make LPG cylinder orders, exchanges, delivery and customer support straightforward.",
};

export default function AboutRoute() {
  return <AboutPage />;
}
