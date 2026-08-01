import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  BanknoteIcon,
  BellRingIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  MailCheckIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  PackageIcon,
  RefreshCwIcon,
  ReceiptTextIcon,
  SendIcon,
  TriangleAlertIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardBackButton,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AdminRefundManager,
  type AdminOrderRefund,
  type AdminRefundableInvoiceLine,
} from "@/app/(admin)/admin/(dashboard)/orders/[orderId]/refund-manager";
import { retryCreditNoteDeliveryAction } from "@/app/(admin)/admin/(dashboard)/orders/[orderId]/actions";
import {
  getAdminOrderDetail,
  type AdminOrderDetail,
} from "@/src/modules/admin/order-detail";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Order Details",
  description: "Review a Jurgens Energy order and its payment records.",
  robots: { follow: false, index: false },
};

const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  currency: "ZAR",
  style: "currency",
});
const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});

function money(value: number) {
  return moneyFormatter.format(value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (
    [
      "captured",
      "completed",
      "delivered",
      "fulfilled",
      "paid",
      "ready",
      "sent",
    ].includes(status)
  ) {
    return "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["cancelled", "failed", "refunded"].includes(status)) {
    return "border-red-500/20 bg-red-500/12 text-red-700 dark:text-red-300";
  }

  if (["skipped", "not_configured"].includes(status)) {
    return "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-zinc-300";
  }

  return "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function latestNotificationClaim(
  order: AdminOrderDetail,
  eventKey: string,
) {
  return order.automation.notificationClaims.find(
    (claim) => claim.eventKey === eventKey,
  );
}

function latestNotificationEmail(
  order: AdminOrderDetail,
  templateKey: string,
) {
  return order.automation.notificationEmails.find(
    (delivery) => delivery.templateKey === templateKey,
  );
}

function formatMaybeDate(value: Date | null | undefined) {
  return value ? dateFormatter.format(value) : null;
}

function getEmailAutomationStatus(
  delivery: AdminOrderDetail["automation"]["notificationEmails"][number] | undefined,
) {
  if (!delivery) {
    return {
      detail: "No email delivery record yet.",
      status: "pending",
    };
  }

  return {
    detail:
      delivery.status === "sent"
        ? `Sent to ${delivery.recipientEmail} ${formatMaybeDate(delivery.sentAt) ? `on ${formatMaybeDate(delivery.sentAt)}` : ""}`
        : delivery.errorMessage ??
          `Delivery record is ${humanize(delivery.status)} for ${delivery.recipientEmail}.`,
    status: delivery.status,
  };
}

function getClaimAutomationStatus(
  claim: AdminOrderDetail["automation"]["notificationClaims"][number] | undefined,
  missingDetail: string,
) {
  if (!claim) {
    return {
      detail: missingDetail,
      status: "pending",
    };
  }

  return {
    detail:
      claim.status === "sent"
        ? `Completed ${formatMaybeDate(claim.completedAt) ?? formatMaybeDate(claim.updatedAt) ?? ""}.`
        : claim.lastError ??
          `Attempt ${claim.attempts} is ${humanize(claim.status)}.`,
    status: claim.status,
  };
}

function AutomationRow({
  detail,
  icon,
  status,
  title,
}: {
  detail: string;
  icon: ReactNode;
  status: string;
  title: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {title}
          </p>
          <Badge className={cn("rounded-md border capitalize", statusClass(status))}>
            {humanize(status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {detail}
        </p>
      </div>
    </div>
  );
}

function PanelTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
        {icon}
      </span>
      <h2 className="text-sm font-bold text-zinc-950 dark:text-white">{title}</h2>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const { orderId } = await params;
  const order = await getAdminOrderDetail(orderId);

  if (!order) {
    notFound();
  }

  const address = order.deliveryAddress;
  const campaignAttributionRows = order.campaignAttribution
    ? [
        ["Source", order.campaignAttribution.utmSource],
        ["Medium", order.campaignAttribution.utmMedium],
        ["Campaign", order.campaignAttribution.utmCampaign],
        ["Campaign ID", order.campaignAttribution.utmId],
        ["Content", order.campaignAttribution.utmContent],
        ["Search term", order.campaignAttribution.utmTerm],
        [
          "Google click ID",
          order.campaignAttribution.gclid ??
            order.campaignAttribution.wbraid ??
            order.campaignAttribution.gbraid,
        ],
      ].filter((row): row is [string, string] => Boolean(row[1]))
    : [];
  const canManageOrders = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );
  const creditNoteNumberById = new Map(
    order.invoice?.creditNotes.map((creditNote) => [
      creditNote.id,
      creditNote.creditNoteNumber,
    ]) ?? [],
  );
  const openReconciliationExceptions =
    order.reconciliationExceptions.filter(
      (exception) => exception.status === "open",
    );
  const refundableLines: AdminRefundableInvoiceLine[] =
    order.invoice?.lines.flatMap((line) => {
      if (
        (line.kind !== "product" && line.kind !== "shipping") ||
        line.remainingQuantity <= 0 ||
        line.remainingTotalIncludingTax <= 0
      ) {
        return [];
      }

      return [
        {
          description: line.description,
          id: line.id,
          kind: line.kind,
          refundableGrossAmountCents: Math.round(
            line.remainingTotalIncludingTax * 100,
          ),
          refundableQuantity: line.remainingQuantity,
          sku: line.sku,
        },
      ];
    }) ?? [];
  const refundableBalanceCents = refundableLines.reduce(
    (total, line) => total + line.refundableGrossAmountCents,
    0,
  );
  const refundRows: AdminOrderRefund[] = order.refunds.map((refund) => ({
    amountCents: Math.round(refund.amount * 100),
    cancelOpenShipments: refund.cancelOpenShipments,
    createdAt: refund.createdAt.toISOString(),
    creditNoteNumber: refund.creditNoteId
      ? (creditNoteNumberById.get(refund.creditNoteId) ?? null)
      : null,
    id: refund.id,
    fulfillmentActions: refund.fulfillmentActions,
    kind: refund.refundKind,
    manualActionReason: refund.manualActionReason,
    method: refund.refundMethod,
    reason: refund.reason,
    requestedRestockQuantity: refund.requestedRestockQuantity,
    status: refund.status,
  }));
  const customerConfirmationEmail = getEmailAutomationStatus(
    latestNotificationEmail(order, "customer.order.paid"),
  );
  const customerWhatsappClaim =
    latestNotificationClaim(order, "customer.order.paid.whatsapp");
  const customerConfirmationWhatsapp = order.customer.phone.trim()
    ? getClaimAutomationStatus(
        customerWhatsappClaim,
        "No customer WhatsApp dispatch has been recorded yet.",
      )
    : {
        detail: "No customer WhatsApp number was captured for this order.",
        status: "skipped",
      };
  const adminDashboardAlert = getClaimAutomationStatus(
    latestNotificationClaim(order, "admin.order.paid"),
    "No admin paid-order alert has been recorded yet.",
  );
  const internalWhatsappAlert = getClaimAutomationStatus(
    latestNotificationClaim(order, "admin.order.paid.whatsapp"),
    "No internal WhatsApp alert has been recorded yet. Check the WhatsApp paid-order alert settings if this should fire.",
  );
  const paymentCaptured =
    order.paidAt || order.payments.some((payment) => payment.status === "captured")
      ? {
          detail: order.paidAt
            ? `PayFast confirmed payment on ${dateFormatter.format(order.paidAt)}.`
            : "A captured payment record exists.",
          status: "captured",
        }
      : {
          detail: "Payment has not been captured yet.",
          status: order.status,
        };
  const invoiceAutomation = order.invoice
    ? {
        detail: [
          order.invoice.renderedAt
            ? `PDF ready ${dateFormatter.format(order.invoice.renderedAt)}`
            : order.invoice.renderError
              ? `PDF error: ${order.invoice.renderError}`
              : "PDF is still being prepared",
          order.invoice.emailSentAt
            ? `email sent ${dateFormatter.format(order.invoice.emailSentAt)}`
            : "email pending",
          order.invoice.whatsappSentAt
            ? `WhatsApp sent ${dateFormatter.format(order.invoice.whatsappSentAt)}`
            : "WhatsApp pending or skipped",
        ].join(" · "),
        status: order.invoice.renderStatus,
      }
    : {
        detail:
          order.status === "paid" || order.status === "fulfilled"
            ? "No invoice row exists yet; the invoice worker should create it."
            : "Invoice generation waits until payment is captured.",
        status:
          order.status === "paid" || order.status === "fulfilled"
            ? "pending"
            : "skipped",
      };
  const primaryShipment = order.shipments[0] ?? null;
  const fulfilmentAutomation = primaryShipment
    ? {
        detail: [
          primaryShipment.waybillNumber
            ? `Waybill ${primaryShipment.waybillNumber}`
            : "Waybill not ready",
          primaryShipment.providerEnvironment
            ? `${primaryShipment.providerEnvironment} account`
            : null,
          primaryShipment.providerCostAmount !== null
            ? `${money(primaryShipment.providerCostAmount)} courier cost`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        status: primaryShipment.status,
      }
    : {
        detail: "No fulfilment record has been created for this order yet.",
        status: "pending",
      };

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Orders", order.orderNumber]}
        title={order.orderNumber}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DashboardBackButton href="/orders" label="Back to orders" />
        <Badge
          className={cn(
            "rounded-md border px-3 py-1 capitalize",
            statusClass(order.status),
          )}
        >
          {humanize(order.status)}
        </Badge>
      </div>

      {openReconciliationExceptions.length > 0 ? (
        <section className="mb-5 overflow-hidden rounded-lg border border-red-500/35 bg-red-500/[0.06] shadow-sm">
          <div className="flex items-start gap-3 border-b border-red-500/20 px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-red-500/12 text-red-700 dark:text-red-300">
              <TriangleAlertIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-red-800 dark:text-red-200">
                Payment reconciliation required
              </h2>
              <p className="mt-1 text-sm leading-6 text-red-800/85 dark:text-red-200/85">
                PayFast reported a completed payment, but inventory could not be
                assigned safely. This order was not captured or released for
                fulfilment. Do not fulfil it until the payment and stock have
                been reviewed; refund the PayFast payment if the order cannot
                be honoured.
              </p>
            </div>
          </div>
          <div className="divide-y divide-red-500/20">
            {openReconciliationExceptions.map((exception) => (
              <div
                className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_auto]"
                key={exception.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "rounded-md border capitalize",
                        exception.status === "open"
                          ? "border-red-500/25 bg-red-500/12 text-red-700 dark:text-red-300"
                          : "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {humanize(exception.status)}
                    </Badge>
                    <span className="font-semibold capitalize text-zinc-950 dark:text-white">
                      {humanize(exception.reason)}
                    </span>
                  </div>
                  <p className="mt-2 leading-6 text-slate-700 dark:text-zinc-300">
                    {exception.detail}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500 dark:text-zinc-400">
                    PayFast reference{" "}
                    {exception.providerPaymentId ?? "not supplied"} · Last
                    confirmed {dateFormatter.format(exception.lastSeenAt)}
                    {exception.occurrences > 1
                      ? ` · ${exception.occurrences} notifications received`
                      : ""}
                  </p>
                  {exception.resolutionNote ? (
                    <p className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                      Resolution: {exception.resolutionNote}
                    </p>
                  ) : null}
                </div>
                <strong className="tabular-nums text-red-800 dark:text-red-200">
                  {money(exception.receivedAmount)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle icon={<PackageIcon className="size-4" />} title="Order items" />
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {order.items.map((item) => (
                <div
                  className="grid min-w-0 gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-950 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Qty {item.quantity} · {money(item.unitPrice)} each
                    </p>
                  </div>
                  <strong className="tabular-nums text-zinc-950 dark:text-white">
                    {money(item.lineTotal)}
                  </strong>
                </div>
              ))}
            </div>
            <dl className="grid gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm dark:border-white/10 dark:bg-white/[0.025]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Subtotal</dt>
                <dd className="tabular-nums">{money(order.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Delivery</dt>
                <dd className="tabular-nums">{money(order.shippingTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base font-bold dark:border-white/10">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle icon={<BanknoteIcon className="size-4" />} title="Payment history" />
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {order.payments.length === 0 ? (
                <p className="px-5 py-5 text-sm text-slate-500 dark:text-zinc-400">
                  No payment attempt is recorded.
                </p>
              ) : (
                order.payments.map((payment) => (
                  <div
                    className="grid min-w-0 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                    key={payment.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            "rounded-md border capitalize",
                            statusClass(payment.status),
                          )}
                        >
                          {humanize(payment.status)}
                        </Badge>
                        <span className="text-xs font-semibold capitalize text-slate-600 dark:text-zinc-300">
                          {payment.provider}
                        </span>
                      </div>
                      <p className="mt-2 break-all text-xs text-slate-500 dark:text-zinc-400">
                        {payment.providerPaymentId
                          ? `PayFast reference ${payment.providerPaymentId}`
                          : `Attempt ${payment.id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {dateFormatter.format(payment.completedAt ?? payment.createdAt)}
                      </p>
                    </div>
                    <strong className="tabular-nums">{money(payment.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          {order.invoice || order.refunds.length > 0 ? (
            <AdminRefundManager
              canManage={canManageOrders}
              currency={order.currency}
              lines={refundableLines}
              orderId={order.id}
              orderNumber={order.orderNumber}
              refundableBalanceCents={refundableBalanceCents}
              refunds={refundRows}
            />
          ) : null}

          {order.invoice ? (
            <section className={cn("overflow-hidden", dashboardPanelClass)}>
              <PanelTitle icon={<FileTextIcon className="size-4" />} title="Invoice and credits" />
              <div className="grid gap-4 px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4 dark:border-white/10">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{order.invoice.invoiceNumber}</p>
                      <Badge
                        className={cn(
                          "rounded-md border capitalize",
                          statusClass(order.invoice.renderStatus),
                        )}
                      >
                        PDF {humanize(order.invoice.renderStatus)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Issued {dateFormatter.format(order.invoice.issuedAt)} · {humanize(order.invoice.status)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Email{" "}
                      {order.invoice.emailSentAt
                        ? `sent ${dateFormatter.format(order.invoice.emailSentAt)}`
                        : "pending"}{" "}
                      · WhatsApp{" "}
                      {order.invoice.whatsappSentAt
                        ? `sent ${dateFormatter.format(order.invoice.whatsappSentAt)}`
                        : "pending or skipped"}
                    </p>
                    {order.invoice.renderError ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                        {order.invoice.renderError}
                      </p>
                    ) : null}
                  </div>
                  <a
                    className={buttonVariants({
                      className: "h-9 gap-2 rounded-md",
                      variant: "outline",
                    })}
                    href={`/api/invoices/${order.invoice.id}/pdf`}
                  >
                    <DownloadIcon className="size-4" />
                    Invoice PDF
                  </a>
                </div>
                {order.invoice.creditNotes.length > 0 ? (
                  <div className="grid gap-2">
                    {order.invoice.creditNotes.map((creditNote) => (
                      <div
                        className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-white/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        key={creditNote.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {creditNote.creditNoteNumber}
                            </p>
                            <Badge
                              className={cn(
                                "rounded-md border capitalize",
                                statusClass(creditNote.renderStatus),
                              )}
                            >
                              PDF {humanize(creditNote.renderStatus)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                            {creditNote.reason} · {dateFormatter.format(creditNote.issuedAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                            Email {humanize(creditNote.emailDeliveryStatus)} ·
                            WhatsApp {" "}
                            {humanize(creditNote.whatsappDeliveryStatus)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <strong className="tabular-nums text-red-700 dark:text-red-300">
                            −{money(creditNote.totalIncludingTax)}
                          </strong>
                          {creditNote.renderStatus === "ready" ? (
                            <a
                              className={buttonVariants({
                                className: "h-9 gap-2 rounded-md",
                                variant: "outline",
                              })}
                              href={`/api/credit-notes/${creditNote.id}/pdf`}
                            >
                              <DownloadIcon className="size-4" />
                              Credit PDF
                            </a>
                          ) : null}
                          {canManageOrders &&
                          (creditNote.renderStatus === "failed" ||
                            [
                              "failed",
                              "skipped",
                              "verification_required",
                            ].includes(
                              creditNote.emailDeliveryStatus,
                            ) ||
                            [
                              "failed",
                              "skipped",
                              "verification_required",
                            ].includes(
                              creditNote.whatsappDeliveryStatus,
                            )) ? (
                            <form
                              action={retryCreditNoteDeliveryAction}
                              className="flex max-w-sm flex-col items-end gap-2"
                            >
                              <input
                                name="creditNoteId"
                                type="hidden"
                                value={creditNote.id}
                              />
                              {creditNote.emailDeliveryStatus ===
                                "verification_required" ||
                              creditNote.whatsappDeliveryStatus ===
                                "verification_required" ? (
                                <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-left text-xs text-amber-800 dark:text-amber-200">
                                  <input
                                    className="mt-0.5 size-4 shrink-0 accent-[#ff5a1f]"
                                    name="acknowledgeUnknownOutcome"
                                    required
                                    type="checkbox"
                                    value="confirmed"
                                  />
                                  <span>
                                    I checked the provider outcome and accept
                                    that retrying may send a duplicate copy.
                                  </span>
                                </label>
                              ) : null}
                              <button
                                className={buttonVariants({
                                  className: "h-9 gap-2 rounded-md",
                                  variant: "outline",
                                })}
                                type="submit"
                              >
                                <RefreshCwIcon className="size-4" />
                                {creditNote.emailDeliveryStatus ===
                                  "verification_required" ||
                                creditNote.whatsappDeliveryStatus ===
                                  "verification_required"
                                  ? "Verify and retry delivery"
                                  : "Retry delivery"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    No credit notes have been issued.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle icon={<UserRoundIcon className="size-4" />} title="Customer" />
            <dl className="grid gap-3 px-5 py-5 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-zinc-400">Name</dt>
                <dd className="mt-1 font-semibold">{order.customer.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-zinc-400">Email</dt>
                <dd className="mt-1 break-all">{order.customer.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-zinc-400">Phone</dt>
                <dd className="mt-1">{order.customer.phone}</dd>
              </div>
            </dl>
          </section>

          {order.campaignAttribution ? (
            <section className={cn("overflow-hidden", dashboardPanelClass)}>
              <PanelTitle
                icon={<MegaphoneIcon className="size-4" />}
                title="Campaign attribution"
              />
              <dl className="grid gap-3 px-5 py-5 text-sm">
                {campaignAttributionRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500 dark:text-zinc-400">
                      {label}
                    </dt>
                    <dd className="mt-1 break-all font-semibold">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-slate-500 dark:text-zinc-400">
                    Captured
                  </dt>
                  <dd className="mt-1">
                    {dateFormatter.format(
                      new Date(order.campaignAttribution.capturedAt),
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle icon={<MapPinIcon className="size-4" />} title="Delivery address" />
            <address className="px-5 py-5 text-sm not-italic leading-6 text-slate-700 dark:text-zinc-300">
              <p>{address.addressLine1}</p>
              {address.addressLine2 ? <p>{address.addressLine2}</p> : null}
              {address.suburb ? <p>{address.suburb}</p> : null}
              <p>
                {address.city}, {address.province} {address.postalCode}
              </p>
              <p>{address.countryCode}</p>
            </address>
          </section>

          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle
              icon={<BellRingIcon className="size-4" />}
              title="Order automation"
            />
            <div className="grid gap-3 px-5 py-5">
              <AutomationRow
                detail={paymentCaptured.detail}
                icon={<CheckCircle2Icon className="size-4" />}
                status={paymentCaptured.status}
                title="Payment captured"
              />
              <AutomationRow
                detail={customerConfirmationEmail.detail}
                icon={<MailCheckIcon className="size-4" />}
                status={customerConfirmationEmail.status}
                title="Customer confirmation email"
              />
              <AutomationRow
                detail={customerConfirmationWhatsapp.detail}
                icon={<MessageCircleIcon className="size-4" />}
                status={customerConfirmationWhatsapp.status}
                title="Customer WhatsApp confirmation"
              />
              <AutomationRow
                detail={adminDashboardAlert.detail}
                icon={<SendIcon className="size-4" />}
                status={adminDashboardAlert.status}
                title="Admin order alert"
              />
              <AutomationRow
                detail={internalWhatsappAlert.detail}
                icon={<MessageCircleIcon className="size-4" />}
                status={internalWhatsappAlert.status}
                title="Internal WhatsApp alert"
              />
              <AutomationRow
                detail={invoiceAutomation.detail}
                icon={<ReceiptTextIcon className="size-4" />}
                status={invoiceAutomation.status}
                title="VAT invoice"
              />
              <AutomationRow
                detail={fulfilmentAutomation.detail}
                icon={<TruckIcon className="size-4" />}
                status={fulfilmentAutomation.status}
                title="Fulfilment and waybill"
              />
            </div>
          </section>

          <section className={cn("overflow-hidden", dashboardPanelClass)}>
            <PanelTitle icon={<PackageIcon className="size-4" />} title="Fulfilment" />
            <div className="grid gap-3 px-5 py-5">
              {order.shipments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  No shipment has been booked.
                </p>
              ) : (
                order.shipments.map((shipment) => (
                  <div className="rounded-md border border-slate-200 p-3 dark:border-white/10" key={shipment.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold capitalize">
                        {humanize(shipment.provider)}
                      </span>
                      <Badge className={cn("rounded-md border capitalize", statusClass(shipment.status))}>
                        {humanize(shipment.status)}
                      </Badge>
                    </div>
                    {shipment.trackingNumber || shipment.waybillNumber ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                        {shipment.trackingNumber ?? shipment.waybillNumber}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <Link
            className={buttonVariants({
              className: "h-10 w-full rounded-md",
              variant: "outline",
            })}
            href={`/account/orders/${order.id}`}
          >
            View customer-facing order
          </Link>
        </aside>
      </div>
    </>
  );
}
