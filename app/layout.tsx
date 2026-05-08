import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  ThemeCookieBootstrapScript,
  themeStorageKey,
} from "@/components/theme/theme-sync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Piessang Marketplace",
    template: "%s | Piessang",
  },
  description: "Self-hosted multi-vendor marketplace foundation.",
  appleWebApp: {
    capable: true,
    title: "Piessang",
  },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeCookieBootstrapScript />
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
