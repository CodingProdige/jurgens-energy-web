"use client";

import { CalendarClockIcon, MailIcon, PhoneIcon, ReceiptTextIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminWhatsappConversation } from "@/src/modules/admin/whatsapp";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});
const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  currency: "ZAR",
  style: "currency",
});

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return dateFormatter.format(new Date(value));
}

function formatMoney(value: string | number) {
  const amount = Number(value);

  return moneyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold text-zinc-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-500 dark:text-zinc-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium text-zinc-950 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

export function WhatsappCustomerDetails({
  className,
  conversation,
}: {
  className?: string;
  conversation: AdminWhatsappConversation;
}) {
  const lastOrder = conversation.customerStats.lastOrder;

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid place-items-center gap-3 rounded-xl bg-slate-50 p-5 text-center dark:bg-white/[0.04]">
        <div className="grid size-16 place-items-center rounded-full bg-[#00a884] text-xl font-semibold text-white">
          {(conversation.customer.name ?? conversation.phone).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-950 dark:text-white">
            {conversation.customer.name ?? conversation.phone}
          </p>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {conversation.phone}
          </p>
        </div>
        <Badge className="rounded-md border-0 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
          {conversation.activity.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DetailMetric label="Orders" value={conversation.customerStats.orderCount} />
        <DetailMetric
          label="Lifetime spend"
          value={formatMoney(conversation.customerStats.lifetimeOrderValue)}
        />
        <DetailMetric
          label="WhatsApp checkouts"
          value={conversation.customerStats.whatsappOrderCount}
        />
        <DetailMetric
          label="WhatsApp drafts"
          value={conversation.customerStats.whatsappDraftCount}
        />
      </div>

      <div className="grid gap-2">
        <DetailRow icon={PhoneIcon} label="Phone" value={conversation.phone} />
        <DetailRow
          icon={MailIcon}
          label="Email"
          value={conversation.customer.email ?? "No linked email"}
        />
        <DetailRow
          icon={UserIcon}
          label="Account"
          value={
            conversation.customer.accountCreatedAt
              ? `Created ${formatDate(conversation.customer.accountCreatedAt)}`
              : "No linked account"
          }
        />
        <DetailRow
          icon={CalendarClockIcon}
          label="Last WhatsApp checkout"
          value={formatDate(conversation.customerStats.lastWhatsappOrderAt)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-slate-500 dark:text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Last order
          </p>
        </div>
        {lastOrder ? (
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400">Order</span>
              <span className="font-medium text-zinc-950 dark:text-white">
                {lastOrder.orderNumber}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400">Status</span>
              <span className="font-medium capitalize text-zinc-950 dark:text-white">
                {lastOrder.status}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400">Total</span>
              <span className="font-medium text-zinc-950 dark:text-white">
                {formatMoney(lastOrder.grandTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400">Created</span>
              <span className="font-medium text-zinc-950 dark:text-white">
                {formatDate(lastOrder.createdAt)}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
            No online store orders are linked to this customer yet.
          </p>
        )}
      </div>
    </div>
  );
}
