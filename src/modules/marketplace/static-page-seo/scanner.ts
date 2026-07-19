import "server-only";

import { getMarketplaceCanonicalBaseUrl } from "@/src/modules/marketplace/seo";
import {
  extractStaticSeoPageContent,
  StaticSeoPageScanError,
  type StaticSeoExtractedPage,
} from "@/src/modules/marketplace/static-page-seo/content-extraction";
import {
  getStaticSeoPageRegistryEntry,
  type StaticSeoPageKey,
} from "@/src/modules/marketplace/static-page-seo/registry";
const maximumHtmlCharacters = 1_500_000;

export type StaticSeoPageScan = StaticSeoExtractedPage & {
  scannedAt: Date;
  url: string;
};

export { extractStaticSeoPageContent, StaticSeoPageScanError };

export async function scanStaticSeoPage(
  pageKey: StaticSeoPageKey,
): Promise<StaticSeoPageScan> {
  const entry = getStaticSeoPageRegistryEntry(pageKey);
  const baseUrl = getMarketplaceCanonicalBaseUrl();
  const url = new URL(entry.path, baseUrl);

  // The URL is built exclusively from the code-controlled registry. No caller
  // URL or redirect target is accepted, which keeps this scanner out of SSRF
  // territory even though it reads the rendered public page.
  if (url.origin !== baseUrl.origin || url.pathname !== entry.path) {
    throw new StaticSeoPageScanError("The registered page URL is invalid.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "JurgensEnergy-Admin-SEO-Scanner/1.0",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new StaticSeoPageScanError(
        "The registered page redirected instead of returning content.",
      );
    }

    if (!response.ok) {
      throw new StaticSeoPageScanError(
        `The page scan failed with HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.includes("text/html")) {
      throw new StaticSeoPageScanError(
        "The registered page did not return an HTML document.",
      );
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);

    if (declaredLength > maximumHtmlCharacters) {
      throw new StaticSeoPageScanError(
        "The rendered page is too large to scan safely.",
      );
    }

    const html = await response.text();

    return {
      ...extractStaticSeoPageContent({ html, pageKey }),
      scannedAt: new Date(),
      url: url.toString(),
    };
  } catch (error) {
    if (error instanceof StaticSeoPageScanError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new StaticSeoPageScanError("The page scan timed out. Try again.");
    }

    throw new StaticSeoPageScanError(
      "The rendered page could not be reached for scanning.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
