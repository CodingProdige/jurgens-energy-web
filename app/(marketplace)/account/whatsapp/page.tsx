import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccountPageShell } from "@/src/modules/marketplace/account/components";
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
    <AccountPageShell
      active="whatsapp"
      description="Connect the number you use for WhatsApp orders, delivery updates, invoices, and support."
      title="WhatsApp number"
    >
      <div className="w-full max-w-2xl">
        <WhatsappNumberForm
          currentPhone={whatsappLink?.phone ?? null}
          error={getErrorMessage(error)}
          nextPath={nextPath}
        />
      </div>
    </AccountPageShell>
  );
}
