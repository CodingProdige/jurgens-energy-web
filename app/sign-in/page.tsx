import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInMarketplaceWithGoogle } from "@/app/auth/sso/actions";
import { signInCustomerWithPassword } from "@/app/sign-in/actions";
import { MarketplaceAuthScreen } from "@/components/auth/marketplace-auth-screen";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { rememberedEmailCookieName } from "@/src/modules/auth/constants";
import {
  getWhatsappDraftResumePath,
  parseWhatsappDraftToken,
} from "@/src/modules/whatsapp-ordering/draft-tokens";

export const metadata: Metadata = {
  title: "Customer Sign In",
  description: "Sign in to your Piessang marketplace account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ whatsappDraft?: string }>;
}) {
  const session = await auth();
  const cookieStore = await cookies();
  const rememberedEmail = cookieStore.get(rememberedEmailCookieName)?.value;
  const { whatsappDraft } = await searchParams;
  const whatsappDraftToken = parseWhatsappDraftToken(whatsappDraft);

  if (session?.user) {
    redirect(
      whatsappDraftToken
        ? getWhatsappDraftResumePath(whatsappDraftToken)
        : "/",
    );
  }

  const googleAction = signInMarketplaceWithGoogle.bind(
    null,
    whatsappDraftToken,
  );

  return (
    <MarketplaceGate>
      <MarketplaceAuthScreen
        action={signInCustomerWithPassword}
        googleAction={googleAction}
        rememberedEmail={rememberedEmail}
        mode="sign-in"
        whatsappDraftToken={whatsappDraftToken}
      />
    </MarketplaceGate>
  );
}
