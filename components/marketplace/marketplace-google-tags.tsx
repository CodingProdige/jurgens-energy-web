import Script from "next/script";

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
  const gtagIds = [
    settings.googleAnalyticsMeasurementId,
    settings.googleAdsConversionId,
  ].filter((value): value is string => Boolean(value));

  if (!tagManagerId && gtagIds.length === 0) {
    return null;
  }

  const primaryGtagId = gtagIds[0];
  const gtmScript = tagManagerId
    ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(tagManagerId)});`
    : null;
  const gtagScript =
    gtagIds.length > 0
      ? [
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){dataLayer.push(arguments);}",
          "gtag('js', new Date());",
          ...gtagIds.map((id) => `gtag('config', ${JSON.stringify(id)});`),
          settings.googleAdsConversionId && settings.googleAdsConversionLabel
            ? `window.jurgensGoogleAdsConversion = { send_to: ${JSON.stringify(`${settings.googleAdsConversionId}/${settings.googleAdsConversionLabel}`)} };`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  return (
    <>
      {tagManagerId && gtmScript ? (
        <>
          <Script id="google-tag-manager" strategy="afterInteractive">
            {gtmScript}
          </Script>
          <noscript>
            <iframe
              height="0"
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(tagManagerId)}`}
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
              width="0"
            />
          </noscript>
        </>
      ) : null}

      {primaryGtagId && gtagScript ? (
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
    </>
  );
}
