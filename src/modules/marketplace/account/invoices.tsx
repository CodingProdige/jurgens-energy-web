import Link from "next/link";
import {
  ArrowRightIcon,
  DownloadIcon,
  FileClockIcon,
  ReceiptIcon,
  ReceiptTextIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CreditNoteListRow } from "@/src/modules/invoices/credit-note-access";
import type { InvoiceListRow } from "@/src/modules/invoices/access";
import { formatAccountMoney } from "@/src/modules/marketplace/account/components";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "long",
  timeZone: "Africa/Johannesburg",
});

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function invoiceStatusClass(status: InvoiceListRow["status"]) {
  if (status === "issued") {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "credited") {
    return "bg-slate-500/12 text-slate-700 dark:text-slate-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

export function CustomerCreditNoteHistory({
  creditNotes,
}: {
  creditNotes: CreditNoteListRow[];
}) {
  if (creditNotes.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-md border border-[#f0cf77] bg-[#fffaf0] shadow-[0_10px_30px_rgba(8,8,8,0.04)] dark:border-amber-300/20 dark:bg-amber-300/[0.04]">
      <div className="border-b border-[#f0cf77] px-4 py-4 dark:border-amber-300/20 sm:px-5">
        <h2 className="font-black">Tax credit notes</h2>
        <p className="mt-1 text-xs text-[#777770] dark:text-[#aaa9a1]">
          These documents record amounts credited against your original VAT
          invoices. The original invoices remain unchanged.
        </p>
      </div>

      <div className="divide-y divide-[#f0cf77] dark:divide-amber-300/20">
        {creditNotes.map((creditNote) => (
          <article
            className="grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
            key={creditNote.id}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#ffb000]/15 text-[#8a5b00] dark:text-[#ffd36a]">
                <ReceiptIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{creditNote.creditNoteNumber}</p>
                  <Badge className="h-6 rounded-full border-0 bg-[#ffb000]/15 px-2.5 font-bold text-[#7b5200] dark:text-[#ffd36a]">
                    Credit issued
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[#666660] dark:text-[#aaa9a1]">
                  Issued {dateFormatter.format(creditNote.issuedAt)} against {" "}
                  {creditNote.invoiceNumber}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[#777770] dark:text-[#aaa9a1]">
                  {creditNote.reason}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0cf77] pt-3 dark:border-amber-300/20 sm:justify-end sm:border-0 sm:pt-0">
              <strong className="tabular-nums text-[#9a3412] dark:text-[#ffab8c]">
                −
                {formatAccountMoney(
                  creditNote.totalIncludingTax,
                  creditNote.currency,
                )}
              </strong>
              {creditNote.renderStatus === "ready" ? (
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff5a1f] px-3 text-xs font-black text-white transition hover:bg-[#e84c15]"
                  href={`/api/credit-notes/${creditNote.id}/pdf`}
                >
                  <DownloadIcon className="size-3.5" />
                  Download PDF
                </a>
              ) : (
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f0cf77] px-3 text-xs font-bold text-[#777770] dark:border-amber-300/20 dark:text-[#aaa9a1]">
                  <FileClockIcon className="size-3.5" />
                  {creditNote.renderStatus === "failed"
                    ? "PDF needs attention"
                    : "Preparing PDF"}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CustomerInvoiceHistory({
  invoices,
}: {
  invoices: InvoiceListRow[];
}) {
  if (invoices.length === 0) {
    return (
      <section className="grid min-h-72 place-items-center rounded-md border border-dashed border-[#d9d9d2] bg-white px-6 py-12 text-center dark:border-white/15 dark:bg-[#101010]">
        <div className="max-w-md">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <ReceiptTextIcon className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-black">No invoices yet</h2>
          <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
            A VAT invoice will appear here after a successful payment has been
            verified and its PDF has been prepared.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white transition hover:bg-[#e84c15]"
            href="/account/orders"
          >
            View my orders
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-[#deded7] bg-white shadow-[0_10px_30px_rgba(8,8,8,0.04)] dark:border-white/10 dark:bg-[#101010]">
      <div className="border-b border-[#e8e8e2] px-4 py-4 dark:border-white/10 sm:px-5">
        <h2 className="font-black">VAT invoices</h2>
        <p className="mt-1 text-xs text-[#777770] dark:text-[#aaa9a1]">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"} available
          for this account.
        </p>
      </div>

      <div className="divide-y divide-[#e8e8e2] dark:divide-white/10">
        {invoices.map((invoice) => (
          <article
            className="grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
            key={invoice.id}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
                <ReceiptTextIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{invoice.invoiceNumber}</p>
                  <Badge
                    className={cn(
                      "h-6 rounded-full border-0 px-2.5 font-bold capitalize",
                      invoiceStatusClass(invoice.status),
                    )}
                  >
                    {humanize(invoice.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[#666660] dark:text-[#aaa9a1]">
                  Issued {dateFormatter.format(invoice.issuedAt)}
                </p>
                <Link
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#d9460f] transition hover:text-[#ff5a1f] dark:text-[#ff8a60]"
                  href={`/account/orders/${invoice.orderId}`}
                >
                  Order {invoice.orderNumber}
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e8e2] pt-3 dark:border-white/10 sm:justify-end sm:border-0 sm:pt-0">
              <strong className="tabular-nums">
                {formatAccountMoney(
                  invoice.totalIncludingTax,
                  invoice.currency,
                )}
              </strong>
              {invoice.renderStatus === "ready" ? (
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff5a1f] px-3 text-xs font-black text-white transition hover:bg-[#e84c15]"
                  href={`/api/invoices/${invoice.id}/pdf`}
                >
                  <DownloadIcon className="size-3.5" />
                  Download PDF
                </a>
              ) : (
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[#deded7] px-3 text-xs font-bold text-[#777770] dark:border-white/10 dark:text-[#aaa9a1]">
                  <FileClockIcon className="size-3.5" />
                  {invoice.renderStatus === "failed"
                    ? "PDF needs attention"
                    : "Preparing PDF"}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
