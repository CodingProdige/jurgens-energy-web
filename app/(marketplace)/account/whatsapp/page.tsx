import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { getPrimaryWhatsappCustomerLinkForUser } from "@/src/modules/whatsapp-ordering/customer-links";
import { WhatsappNumberForm } from "@/app/(marketplace)/account/whatsapp/whatsapp-number-form";

export const metadata: Metadata = {
  title: "WhatsApp Number",
  description: "Link your WhatsApp number to your Jurgens Energy account.",
  robots: { follow: false, index: false },
};

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

function getErrorMessage(error: string | undefined) {
  if (error === "link_conflict") {
    return "That WhatsApp order link is already connected to another account. Add your own WhatsApp number here or contact support.";
  }

  return undefined;
}

export default async function AccountWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [{ error, next }, whatsappLink] = await Promise.all([
    searchParams,
    getPrimaryWhatsappCustomerLinkForUser(session.user.id),
  ]);
  const nextPath = getSafeNextPath(next);

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip bg-[#f7f7f2] pb-10 dark:bg-[#080808] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))]">
          <div className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
            <WhatsappNumberForm
              currentPhone={whatsappLink?.phone ?? null}
              error={getErrorMessage(error)}
              nextPath={nextPath}
            />
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
