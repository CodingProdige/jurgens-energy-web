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
