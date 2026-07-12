"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import {
  getSsoCompletionPath,
  getSsoStartUrl,
  isGoogleAuthConfigured,
  type SsoIntent,
} from "@/src/modules/auth/sso";
import { parseWhatsappDraftToken } from "@/src/modules/whatsapp-ordering/draft-tokens";

async function getRequestRedirectUrl(pathname: string) {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const protocol = forwardedProto ?? "http";

  if (!host) {
    return pathname;
  }

  return new URL(pathname, `${protocol}://${host}`).toString();
}

async function signInWithGoogleForIntent(
  intent: SsoIntent,
  whatsappDraftToken?: string | null,
) {
  if (!isGoogleAuthConfigured()) {
    throw new Error(
      "Google auth is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
    );
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const rootHost = new URL(
    process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000",
  ).host;

  if (host && host !== rootHost) {
    redirect(
      getSsoStartUrl(intent, {
        whatsappDraft: parseWhatsappDraftToken(whatsappDraftToken),
      }),
    );
  }

  await signIn("google", {
    redirectTo: await getRequestRedirectUrl(
      getSsoCompletionPath(intent, {
        whatsappDraft: parseWhatsappDraftToken(whatsappDraftToken),
      }),
    ),
  });
}

export async function signInMarketplaceWithGoogle(
  whatsappDraftToken?: string | null,
) {
  await signInWithGoogleForIntent("marketplace_sign_in", whatsappDraftToken);
}

export async function registerMarketplaceWithGoogle(
  whatsappDraftToken?: string | null,
) {
  await signInWithGoogleForIntent("marketplace_register", whatsappDraftToken);
}

export async function signInAdminWithGoogle() {
  await signInWithGoogleForIntent("admin_sign_in");
}

export async function signInSellerWithGoogle() {
  await signInWithGoogleForIntent("seller_sign_in");
}

export async function registerSellerWithGoogle() {
  await signInWithGoogleForIntent("seller_register");
}
