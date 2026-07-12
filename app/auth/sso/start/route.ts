import { NextResponse, type NextRequest } from "next/server";

import { signIn } from "@/auth";
import {
  getSsoCompletionPath,
  isGoogleAuthConfigured,
  isSsoIntent,
} from "@/src/modules/auth/sso";
import { parseWhatsappDraftToken } from "@/src/modules/whatsapp-ordering/draft-tokens";

export async function GET(request: NextRequest) {
  const rawIntent = request.nextUrl.searchParams.get("intent");
  const whatsappDraftToken = parseWhatsappDraftToken(
    request.nextUrl.searchParams.get("whatsappDraft"),
  );

  if (!isSsoIntent(rawIntent)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (!isGoogleAuthConfigured()) {
    throw new Error(
      "Google auth is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
    );
  }

  await signIn("google", {
    redirectTo: getSsoCompletionPath(rawIntent, {
      whatsappDraft: whatsappDraftToken,
    }),
  });
}
