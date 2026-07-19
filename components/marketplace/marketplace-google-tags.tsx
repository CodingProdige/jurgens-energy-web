import Script from "next/script";
import { Suspense } from "react";

import { MarketplaceGoogleConsent } from "@/components/marketplace/marketplace-google-consent";
import { MarketplaceGoogleRuntime } from "@/components/marketplace/marketplace-google-runtime";
import type { MarketplaceSettings } from "@/src/modules/marketplace/settings";

type MarketplaceGoogleTagsProps = {
  settings: Pick<
    MarketplaceSettings,
    | "googleAdsConversionId"
    | "googleAdsConversionLabel"
    | "googleAnalyticsMeasurementId"
    | "googleTagManagerId"
  >;
};

export function MarketplaceGoogleTags({ settings }: MarketplaceGoogleTagsProps) {
  const tagManagerId = settings.googleTagManagerId;
  const gtagIds = Array.from(
    new Set(
      [
        settings.googleAnalyticsMeasurementId,
        settings.googleAdsConversionId,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  if (!tagManagerId && gtagIds.length === 0) {
    return null;
  }

  const primaryGtagId = gtagIds[0];
  const adsConversionDestination =
    settings.googleAdsConversionId && settings.googleAdsConversionLabel
      ? `${settings.googleAdsConversionId}/${settings.googleAdsConversionLabel}`
      : null;
  // A configured GTM container owns Google tag configuration. Loading gtag.js
  // as well would let the same GA4/Ads destination record events twice.
  const mode = tagManagerId ? "gtm" : "gtag";
  const runtimeConfig = [
    `window.jurgensGoogleTagMode=${JSON.stringify(mode)};`,
    "window.jurgensGoogleEventQueue=window.jurgensGoogleEventQueue||[];",
    adsConversionDestination
      ? `window.jurgensGoogleAdsConversion={send_to:${JSON.stringify(adsConversionDestination)}};`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const markReady = [
    "window.jurgensGoogleTagsReady=true;",
    "window.dispatchEvent(new Event('jurgens:google-tags-ready'));",
  ].join("\n");
  const gtmScript = tagManagerId
    ? `${runtimeConfig}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(tagManagerId)});
${markReady}`
    : null;
  const gtagScript =
    !tagManagerId && gtagIds.length > 0
      ? [
          runtimeConfig,
          "window.dataLayer = window.dataLayer || [];",
          "window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};",
          "window.gtag('js', new Date());",
          ...gtagIds.map((id) => {
            const options =
              id === settings.googleAnalyticsMeasurementId
                ? ", { send_page_view: false }"
                : "";
            return `window.gtag('config', ${JSON.stringify(id)}${options});`;
          }),
          markReady,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  return (
    <>
      {tagManagerId && gtmScript ? (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {gtmScript}
        </Script>
      ) : null}

      {!tagManagerId && primaryGtagId && gtagScript ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryGtagId)}`}
            strategy="afterInteractive"
          />
          <Script id="google-gtag-config" strategy="afterInteractive">
            {gtagScript}
          </Script>
        </>
      ) : null}

      <Suspense fallback={null}>
        <MarketplaceGoogleRuntime
          mode={mode}
          trackPageViews={
            mode === "gtag" && Boolean(settings.googleAnalyticsMeasurementId)
          }
        />
      </Suspense>
      <MarketplaceGoogleConsent />
    </>
  );
}
