import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerMarketplaceWithGoogle } from "@/app/auth/sso/actions";
import { registerCustomerWithPassword } from "@/app/register/actions";
import { MarketplaceAuthScreen } from "@/components/auth/marketplace-auth-screen";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { getWhatsappDraftCustomerPhoneByToken } from "@/src/modules/whatsapp-ordering/customer-links";
import {
  getWhatsappDraftResumePath,
  parseWhatsappDraftToken,
} from "@/src/modules/whatsapp-ordering/draft-tokens";

export const metadata: Metadata = {
  title: "Create Online Store Account",
  description: "Create your Jurgens Energy online-store account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ whatsappDraft?: string }>;
}) {
  const { whatsappDraft } = await searchParams;
  const whatsappDraftToken = parseWhatsappDraftToken(whatsappDraft);
  const session = await auth();

  if (session?.user) {
    redirect(
      whatsappDraftToken
        ? getWhatsappDraftResumePath(whatsappDraftToken)
        : "/",
    );
  }

  const googleAction = registerMarketplaceWithGoogle.bind(
    null,
    whatsappDraftToken,
  );
  const whatsappPhoneDefault = whatsappDraftToken
    ? await getWhatsappDraftCustomerPhoneByToken(whatsappDraftToken)
    : null;

  return (
    <MarketplaceGate>
      <MarketplaceAuthScreen
        action={registerCustomerWithPassword}
        googleAction={googleAction}
        mode="register"
        whatsappDraftToken={whatsappDraftToken}
        whatsappPhoneDefault={whatsappPhoneDefault}
        whatsappPhoneLocked={Boolean(whatsappPhoneDefault)}
      />
    </MarketplaceGate>
  );
}
