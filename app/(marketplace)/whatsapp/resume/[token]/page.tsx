import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { WhatsappDraftResume } from "@/components/marketplace/whatsapp-draft-resume";
import { parseWhatsappDraftToken } from "@/src/modules/whatsapp-ordering/draft-tokens";

export const metadata: Metadata = {
  title: "WhatsApp Order",
  description: "Resume a Jurgens Energy order started from WhatsApp.",
  robots: { follow: false, index: false },
};

export default async function WhatsappResumePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsedToken = parseWhatsappDraftToken(token);
  const session = await auth();

  if (!parsedToken) {
    redirect("/products");
  }

  if (!session?.user) {
    redirect(`/register?whatsappDraft=${encodeURIComponent(parsedToken)}`);
  }

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip bg-[#f7f7f2] dark:bg-[#080808] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))]">
          <WhatsappDraftResume token={parsedToken} />
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
