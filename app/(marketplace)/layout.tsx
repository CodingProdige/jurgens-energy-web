import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMarketplaceSettings();

  if (!settings.googleSiteVerificationToken) {
    return {};
  }

  return {
    verification: {
      google: settings.googleSiteVerificationToken,
    },
  };
}

export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
