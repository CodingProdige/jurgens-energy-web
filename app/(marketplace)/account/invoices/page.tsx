import type { Metadata } from "next";

import { listCustomerCreditNotes } from "@/src/modules/invoices/credit-note-access";
import { listCustomerInvoices } from "@/src/modules/invoices/access";
import { AccountPageShell } from "@/src/modules/marketplace/account/components";
import { requireCustomerAccount } from "@/src/modules/marketplace/account/data";
import {
  CustomerCreditNoteHistory,
  CustomerInvoiceHistory,
} from "@/src/modules/marketplace/account/invoices";

export const metadata: Metadata = {
  title: "My Invoices",
  description: "Review and download your Jurgens Energy VAT invoices.",
  robots: { follow: false, index: false },
};

export default async function AccountInvoicesPage() {
  const account = await requireCustomerAccount();
  const [invoices, creditNotes] = await Promise.all([
    listCustomerInvoices(account.id),
    listCustomerCreditNotes(account.id),
  ]);

  return (
    <AccountPageShell
      active="invoices"
      description="Download your immutable VAT invoices and any tax credit notes issued after a completed refund."
      title="My invoices"
    >
      <div className="grid gap-5">
        <CustomerCreditNoteHistory creditNotes={creditNotes} />
        <CustomerInvoiceHistory invoices={invoices} />
      </div>
    </AccountPageShell>
  );
}
