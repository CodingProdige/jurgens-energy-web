import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ComingSoonScreen } from "@/components/marketplace/coming-soon-screen";
import {
  getMarketplaceSettings,
  isMarketplacePreviewTokenValid,
  marketplaceComingSoonCookieName,
} from "@/src/modules/marketplace/settings";

type MarketplaceGateProps = {
  children: ReactNode;
};

export async function MarketplaceGate({ children }: MarketplaceGateProps) {
  await connection();

  const settings = await getMarketplaceSettings();

  if (!settings.comingSoonEnabled) {
    return children;
  }

  const cookieStore = await cookies();
  const previewToken = cookieStore.get(marketplaceComingSoonCookieName)?.value;
  const hasPreviewAccess = await isMarketplacePreviewTokenValid(previewToken);

  if (hasPreviewAccess) {
    return children;
  }

  return (
    <ComingSoonScreen
      socialLinks={{
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        twitterUrl: settings.twitterUrl,
      }}
    />
  );
}
