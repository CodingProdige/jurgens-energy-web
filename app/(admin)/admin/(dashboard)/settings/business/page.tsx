import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  getBusinessInformation,
  isInvoiceBusinessInformationReady,
} from "@/src/modules/business-information";
import { BusinessInformationForm } from "@/app/(admin)/admin/(dashboard)/settings/business/business-information-form";

export const metadata: Metadata = {
  title: "Business Information",
  description: "Manage the legal, VAT, invoice, and courier identity of Jurgens Energy.",
  robots: { follow: false, index: false },
};

export default async function BusinessInformationPage() {
  const access = await requireAdminCapability("admin.settings.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const information = await getBusinessInformation();
  const invoiceReady = isInvoiceBusinessInformationReady(information);

  return (
    <>
      <div className="mb-7 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Admin</span>
          <span>/</span>
          <span>Settings</span>
          <span>/</span>
          <span>Business information</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-normal text-zinc-950 dark:text-white">
          Business information
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
          Control the registered business, VAT, invoice, and courier collection
          information used throughout the storefront, checkout, shipping, and
          customer documents.
        </p>
      </div>

      {!invoiceReady ? (
        <div className="mb-5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Complete the legal name, VAT number, contact details, and registered
          address before automatic VAT invoices can be issued.
        </div>
      ) : null}

      <DashboardPanel
        title="Jurgens Energy business profile"
        description="Changes apply to future invoices only. Previously issued invoice snapshots remain unchanged."
      >
        <BusinessInformationForm information={information} />
      </DashboardPanel>
    </>
  );
}
