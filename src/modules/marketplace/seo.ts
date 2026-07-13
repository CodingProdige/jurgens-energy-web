import { env } from "@/src/config/env";

export function getMarketplaceCanonicalBaseUrl() {
  const url = new URL(env.APP_URL);

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url;
}

export function createMarketplaceCanonicalUrl(path: string) {
  return new URL(path, getMarketplaceCanonicalBaseUrl()).toString();
}
