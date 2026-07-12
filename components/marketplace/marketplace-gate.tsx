import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ComingSoonScreen } from "@/components/marketplace/coming-soon-screen";
import { MarketplaceGoogleTags } from "@/components/marketplace/marketplace-google-tags";
import { MarketplaceWhatsAppButton } from "@/components/marketplace/marketplace-whatsapp-button";
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
    return (
      <>
        <MarketplaceGoogleTags settings={settings} />
        {children}
        <MarketplaceWhatsAppButton
          enabled={settings.whatsappOrderingEnabled}
          phoneNumber={settings.whatsappBusinessPhoneNumber}
        />
      </>
    );
  }

  const cookieStore = await cookies();
  const previewToken = cookieStore.get(marketplaceComingSoonCookieName)?.value;
  const hasPreviewAccess = await isMarketplacePreviewTokenValid(previewToken);

  if (hasPreviewAccess) {
    return (
      <>
        <MarketplaceGoogleTags settings={settings} />
        {children}
        <MarketplaceWhatsAppButton
          enabled={settings.whatsappOrderingEnabled}
          phoneNumber={settings.whatsappBusinessPhoneNumber}
        />
      </>
    );
  }

  return (
    <>
      <MarketplaceGoogleTags settings={settings} />
      <ComingSoonScreen
        socialLinks={{
          facebookUrl: settings.facebookUrl,
          instagramUrl: settings.instagramUrl,
          twitterUrl: settings.twitterUrl,
        }}
      />
    </>
  );
}
