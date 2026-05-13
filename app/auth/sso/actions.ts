"use server";

import { headers } from "next/headers";

import { signIn } from "@/auth";
import {
  getSsoCompletionPath,
  isGoogleAuthConfigured,
  type SsoIntent,
} from "@/src/modules/auth/sso";

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

async function signInWithGoogleForIntent(intent: SsoIntent) {
  if (!isGoogleAuthConfigured()) {
    throw new Error(
      "Google auth is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
    );
  }

  await signIn("google", {
    redirectTo: await getRequestRedirectUrl(getSsoCompletionPath(intent)),
  });
}

export async function signInMarketplaceWithGoogle() {
  await signInWithGoogleForIntent("marketplace_sign_in");
}

export async function registerMarketplaceWithGoogle() {
  await signInWithGoogleForIntent("marketplace_register");
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
