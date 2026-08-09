import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ComingSoonScreen } from "@/components/marketplace/coming-soon-screen";
import { MarketplaceGoogleTags } from "@/components/marketplace/marketplace-google-tags";
import { MarketplaceTidioButton } from "@/components/marketplace/marketplace-tidio-button";
import { MarketplaceWhatsAppButton } from "@/components/marketplace/marketplace-whatsapp-button";
import {
  getMarketplaceSettings,
  isMarketplacePreviewTokenValid,
  legacyMarketplaceComingSoonCookieName,
  marketplaceComingSoonCookieName,
} from "@/src/modules/marketplace/settings";
import { normalizeTidioPublicKey } from "@/src/modules/marketplace/tidio";

type MarketplaceGateProps = {
  allowTidioLauncher?: boolean;
  children: ReactNode;
};

export async function MarketplaceGate({
  allowTidioLauncher = true,
  children,
}: MarketplaceGateProps) {
  await connection();

  const settings = await getMarketplaceSettings();
  const tidioPublicKey = normalizeTidioPublicKey(settings.tidioPublicKey);
  const supportButton =
    settings.storefrontSupportProvider === "whatsapp" &&
    settings.whatsappOrderingEnabled &&
    settings.hasWhatsappApiKey &&
    settings.whatsappBusinessPhoneNumber ? (
      <MarketplaceWhatsAppButton
        enabled
        phoneNumber={settings.whatsappBusinessPhoneNumber}
      />
    ) : allowTidioLauncher &&
      settings.storefrontSupportProvider === "tidio" &&
      settings.tidioEnabled &&
      tidioPublicKey ? (
      <MarketplaceTidioButton publicKey={tidioPublicKey} />
    ) : null;

  if (!settings.comingSoonEnabled) {
    return (
      <>
        <MarketplaceGoogleTags settings={settings} />
        {children}
        {supportButton}
      </>
    );
  }

  const cookieStore = await cookies();
  const previewToken =
    cookieStore.get(marketplaceComingSoonCookieName)?.value ??
    cookieStore.get(legacyMarketplaceComingSoonCookieName)?.value;
  const hasPreviewAccess = await isMarketplacePreviewTokenValid(previewToken);

  if (hasPreviewAccess) {
    return (
      <>
        <MarketplaceGoogleTags settings={settings} />
        {children}
        {supportButton}
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
