export const ssoIntents = [
  "marketplace_sign_in",
  "marketplace_register",
  "seller_sign_in",
  "seller_register",
  "admin_sign_in",
] as const;

export type SsoIntent = (typeof ssoIntents)[number];

export function isSsoIntent(value: unknown): value is SsoIntent {
  return (
    typeof value === "string" && ssoIntents.includes(value as SsoIntent)
  );
}

export function getSsoCompletionPath(intent: SsoIntent) {
  return `/auth/sso/complete?intent=${intent}`;
}

export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

function getBaseAppUrl() {
  return new URL(process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000");
}

function getConfiguredHostname(
  surface: "admin" | "marketplace" | "seller",
) {
  if (surface === "marketplace") {
    return getBaseAppUrl().hostname;
  }

  if (surface === "admin") {
    return process.env.ADMIN_HOSTNAME ?? "admin.localhost";
  }

  return process.env.SELLER_HOSTNAME ?? "seller.localhost";
}

export function getSsoStartUrl(intent: SsoIntent) {
  const url = getBaseAppUrl();
  url.pathname = "/auth/sso/start";
  url.search = new URLSearchParams({ intent }).toString();

  return url.toString();
}

export function getSurfaceUrl(
  surface: "admin" | "marketplace" | "seller",
  pathname = "/",
  searchParams?: Record<string, string | undefined>,
) {
  const url = getBaseAppUrl();
  url.hostname = getConfiguredHostname(surface);
  const [path, search = ""] = pathname.split("?");
  url.pathname = path || "/";
  url.search = search;

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}
