import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { themeStorageKey } from "@/components/theme/theme-sync";
import { buildGoogleConsentDefaultsScript } from "@/src/modules/analytics/google-consent";
import { getMarketplaceCanonicalBaseUrl } from "@/src/modules/marketplace/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getMarketplaceCanonicalBaseUrl(),
  title: {
    default: "Jurgens Energy",
    template: "%s | Jurgens Energy",
  },
  description:
    "Shop LPG cylinders, exchange-supported options and gas accessories from Jurgens Energy.",
  openGraph: {
    description:
      "Shop LPG cylinders, exchange-supported options and gas accessories from Jurgens Energy.",
    siteName: "Jurgens Energy",
    title: "Jurgens Energy",
    type: "website",
  },
  twitter: {
    card: "summary",
    description:
      "Shop LPG cylinders, exchange-supported options and gas accessories from Jurgens Energy.",
    title: "Jurgens Energy",
  },
  appleWebApp: {
    capable: true,
    title: "Jurgens Energy",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script id="google-consent-defaults" strategy="beforeInteractive">
          {buildGoogleConsentDefaultsScript()}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={themeStorageKey}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
