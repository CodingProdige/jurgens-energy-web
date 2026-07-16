"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  CircleDollarSignIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  reconcileRefundAction,
  submitRefundAction,
  type RefundMutationState,
} from "@/app/(admin)/admin/(dashboard)/orders/[orderId]/actions";
import {
  dashboardControlClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AdminRefundStatus =
  | "pending"
  | "manual_required"
  | "submitted"
  | "verification_required"
  | "completed"
  | "failed";

export type AdminRefundableInvoiceLine = {
  description: string;
  id: string;
  kind: "product" | "shipping";
  refundableGrossAmountCents: number;
  refundableQuantity: number;
  sku: string | null;
};

export type AdminOrderRefund = {
  amountCents: number;
  createdAt: string;
  creditNoteNumber: string | null;
  id: string;
  kind: "full" | "partial";
  manualActionReason: string | null;
  method:
    | "payment_source"
    | "bank_payout"
    | "not_available"
    | "unknown";
  reason: string;
  status: AdminRefundStatus;
};

export type AdminRefundManagerProps = {
  canManage: boolean;
  currency?: string;
  lines: AdminRefundableInvoiceLine[];
  orderId: string;
  orderNumber: string;
  refundableBalanceCents: number;
  refunds: AdminOrderRefund[];
};

type DraftAllocation = {
  grossAmountCents: number;
  invoiceLineId: string;
  quantity: number;
};

const initialMutationState: RefundMutationState = {};

const statusLabels: Record<AdminRefundStatus, string> = {
  completed: "Completed",
  failed: "Failed",
  manual_required: "Manual action required",
  pending: "Pending",
  submitted: "Submitted",
  verification_required: "Verification required",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createIdempotencyKey(orderId: string) {
  const nonce =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return `admin-refund:${orderId}:${nonce}`;
}

function statusClass(status: AdminRefundStatus) {
  if (status === "completed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "failed") {
    return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function MutationMessage({ state }: { state: RefundMutationState }) {
  if (!state.message) {
    return null;
  }

  const successful = state.ok && state.status === "completed";
  const caution = state.ok && state.status !== "completed";

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-5",
        successful &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
        caution &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
        !state.ok &&
          "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      {successful ? (
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      )}
      <p className="min-w-0">{state.message}</p>
    </div>
  );
}

function ReconcileRefundButton({
  orderId,
  refundId,
}: {
  orderId: string;
  refundId: string;
}) {
  const [state, formAction, pending] = useActionState(
    reconcileRefundAction,
    initialMutationState,
  );

  return (
    <div className="grid justify-items-end gap-2">
      <form action={formAction}>
        <input name="orderId" type="hidden" value={orderId} />
        <input name="refundId" type="hidden" value={refundId} />
        <Button
          className={cn("h-8 gap-2 rounded-lg", dashboardControlClass)}
          disabled={pending}
          type="submit"
          variant="outline"
        >
          {pending ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          {pending ? "Checking..." : "Check PayFast status"}
        </Button>
      </form>
      <MutationMessage state={state} />
    </div>
  );
}

function RefundForm({
  currency = "ZAR",
  idempotencyKey,
  lines,
  orderId,
  orderNumber,
  refundableBalanceCents,
}: Omit<AdminRefundManagerProps, "canManage" | "refunds"> & {
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitRefundAction,
    initialMutationState,
  );
  const [kind, setKind] = useState<"full" | "partial">("full");
  const [reason, setReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [quantityValues, setQuantityValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        lines
          .filter((line) => line.kind === "product")
          .map((line) => [line.id, String(line.refundableQuantity)]),
      ),
  );
  const { allocations, allocationError, partialTotalCents } = useMemo(() => {
    const nextAllocations: DraftAllocation[] = [];
    let error: string | null = null;

    for (const line of lines) {
      if (!selectedIds.has(line.id)) {
        continue;
      }

      if (line.kind === "product") {
        const quantity = Number(quantityValues[line.id] ?? "");

        if (
          !Number.isFinite(quantity) ||
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          quantity > line.refundableQuantity
        ) {
          error = `Enter a whole quantity from 1 to ${line.refundableQuantity} for ${line.description}.`;
          continue;
        }

        const grossAmountCents =
          quantity === line.refundableQuantity
            ? line.refundableGrossAmountCents
            : Math.round(
                (line.refundableGrossAmountCents * quantity) /
                  line.refundableQuantity,
              );

        if (grossAmountCents <= 0) {
          error = `The refund value for ${line.description} is too small.`;
          continue;
        }

        nextAllocations.push({
          grossAmountCents,
          invoiceLineId: line.id,
          quantity,
        });
        continue;
      }

      nextAllocations.push({
        grossAmountCents: line.refundableGrossAmountCents,
        invoiceLineId: line.id,
        quantity: line.refundableQuantity,
      });
    }

    if (!error && selectedIds.size === 0) {
      error = "Select at least one invoice line to issue a partial refund.";
    }

    return {
      allocationError: error,
      allocations: nextAllocations,
      partialTotalCents: nextAllocations.reduce(
        (total, allocation) => total + allocation.grossAmountCents,
        0,
      ),
    };
  }, [lines, quantityValues, selectedIds]);

  const refundTotalCents =
    kind === "full" ? refundableBalanceCents : partialTotalCents;
  const formBlocked =
    pending ||
    reason.trim().length < 3 ||
    !idempotencyKey ||
    refundTotalCents <= 0 ||
    (kind === "partial" && Boolean(allocationError));

  function toggleLine(line: AdminRefundableInvoiceLine, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (selected) {
        next.add(line.id);
      } else {
        next.delete(line.id);
      }

      return next;
    });
  }

  return (
    <form action={formAction} className="contents">
      <input name="allocations" type="hidden" value={JSON.stringify(allocations)} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="kind" type="hidden" value={kind} />
      <input name="orderId" type="hidden" value={orderId} />

      <DialogBody className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
          {(["full", "partial"] as const).map((option) => (
            <Button
              className={cn(
                "h-9 rounded-md",
                kind === option
                  ? "bg-white text-zinc-950 shadow-sm hover:bg-white dark:bg-[#25282b] dark:text-white dark:hover:bg-[#25282b]"
                  : "bg-transparent text-slate-600 shadow-none hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-white/[0.05]",
              )}
              key={option}
              disabled={pending}
              onClick={() => setKind(option)}
              type="button"
            >
              {option === "full" ? "Full remaining refund" : "Partial refund"}
            </Button>
          ))}
        </div>

        {kind === "full" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
              Remaining refundable balance
            </p>
            <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">
              {formatMoney(refundableBalanceCents, currency)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-400">
              All remaining refundable invoice lines for {orderNumber} will be
              included. Previously completed or active refund allocations are
              excluded by the server.
            </p>
          </div>
        ) : (
          <fieldset className="grid min-w-0 gap-3">
            <legend className="text-sm font-semibold text-zinc-950 dark:text-white">
              Select invoice lines
            </legend>
            {lines.map((line) => {
              const selected = selectedIds.has(line.id);

              return (
                <div
                  className={cn(
                    "grid min-w-0 gap-3 rounded-xl border p-3 transition",
                    selected
                      ? "border-[#ff5a1f]/50 bg-[#ff5a1f]/5"
                      : "border-slate-200 dark:border-white/10",
                  )}
                  key={line.id}
                >
                  <label className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={selected}
                      className="mt-0.5 data-checked:border-[#ff5a1f] data-checked:bg-[#ff5a1f]"
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        toggleLine(line, checked === true)
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
                        {line.description}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
                        {line.sku ? `${line.sku} · ` : ""}
                        {formatMoney(line.refundableGrossAmountCents, currency)} remaining
                      </span>
                    </span>
                  </label>

                  {selected ? (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      {line.kind === "product" ? (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`refund-line-${line.id}`}>
                            Refund quantity
                          </Label>
                          <Input
                            className="h-10 border-slate-300 bg-white dark:border-white/15 dark:bg-[#151719]"
                            disabled={pending}
                            id={`refund-line-${line.id}`}
                            max={line.refundableQuantity}
                            min={1}
                            onChange={(event) => {
                              setQuantityValues((current) => ({
                                ...current,
                                [line.id]: event.target.value,
                              }));
                            }}
                            step={1}
                            type="number"
                            value={quantityValues[line.id]}
                          />
                        </div>
                      ) : (
                        <p className="pb-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          The remaining delivery charge will be refunded in
                          full.
                        </p>
                      )}
                      <p className="pb-2 text-right text-sm font-bold text-zinc-950 dark:text-white">
                        {formatMoney(
                          allocations.find(
                            (allocation) => allocation.invoiceLineId === line.id,
                          )?.grossAmountCents ?? 0,
                          currency,
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {allocationError ? (
              <p className="text-xs leading-5 text-red-600 dark:text-red-300">
                {allocationError}
              </p>
            ) : null}
          </fieldset>
        )}

        <div className="grid gap-2">
          <Label className="font-semibold" htmlFor="refund-reason">
            Reason <span className="text-red-500">*</span>
          </Label>
          <Textarea
            className="min-h-24 border-slate-300 bg-white dark:border-white/15 dark:bg-[#151719]"
            disabled={pending}
            id="refund-reason"
            maxLength={255}
            minLength={3}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this refund is being issued..."
            required
            value={reason}
          />
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            This reason is recorded against the refund and credit note.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
          <Checkbox checked disabled className="mt-0.5" />
          <div>
            <p className="font-semibold">Notify the buyer through PayFast</p>
            <p className="mt-1 text-xs leading-5 opacity-80">
              Buyer notification is always enabled for refunds issued here.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p className="leading-5">
            Refunding a payment does not restock products, cancel courier
            bookings, or stop fulfilment. Handle those operational steps
            separately when they apply.
          </p>
        </div>

        <MutationMessage state={state} />
      </DialogBody>

      <DialogFooter className="items-stretch sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Refund total
          </p>
          <p className="text-lg font-black text-zinc-950 dark:text-white">
            {formatMoney(refundTotalCents, currency)}
          </p>
        </div>
        <Button
          className="h-10 rounded-lg bg-[#ff5a1f] px-4 font-semibold text-white hover:bg-[#d94514]"
          disabled={formBlocked}
          type="submit"
        >
          {pending ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CircleDollarSignIcon className="size-4" />
          )}
          {pending
            ? "Submitting to PayFast..."
            : `Issue ${formatMoney(refundTotalCents, currency)} refund`}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdminRefundManager({
  canManage,
  currency = "ZAR",
  lines,
  orderId,
  orderNumber,
  refundableBalanceCents,
  refunds,
}: AdminRefundManagerProps) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const refundInProgress = refunds.some((refund) =>
    [
      "pending",
      "manual_required",
      "submitted",
      "verification_required",
    ].includes(refund.status),
  );
  const canIssue =
    canManage &&
    !refundInProgress &&
    refundableBalanceCents > 0 &&
    lines.length > 0;

  function setDialogOpen(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setIdempotencyKey(createIdempotencyKey(orderId));
    }
  }

  return (
    <section className={cn("overflow-hidden", dashboardPanelClass)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Refunds and credit notes
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {refundInProgress
              ? "Resolve the active refund before issuing another one."
              : `${formatMoney(refundableBalanceCents, currency)} remains refundable through PayFast.`}
          </p>
        </div>
        <Button
          className="h-9 gap-2 rounded-lg bg-[#ff5a1f] px-3 text-white hover:bg-[#d94514]"
          disabled={!canIssue}
          onClick={() => setDialogOpen(true)}
          type="button"
        >
          <CircleDollarSignIcon className="size-4" />
          Issue refund
        </Button>
      </div>

      <div className="grid gap-3 p-4">
        {refunds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-zinc-400">
            No refunds have been requested for this order.
          </div>
        ) : (
          refunds.map((refund) => {
            const canReconcile =
              refund.status === "manual_required" ||
              refund.status === "submitted" ||
              refund.status === "verification_required";

            return (
              <article
                className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
                key={refund.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-zinc-950 dark:text-white">
                      {formatMoney(refund.amountCents, currency)}
                    </p>
                    <Badge
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                        statusClass(refund.status),
                      )}
                      variant="outline"
                    >
                      {statusLabels[refund.status]}
                    </Badge>
                    {refund.creditNoteNumber ? (
                      <Badge variant="outline">{refund.creditNoteNumber}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
                    {refund.reason}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {refund.kind === "full" ? "Full" : "Partial"} refund ·{" "}
                    {formatDate(refund.createdAt)}
                  </p>
                  {refund.manualActionReason ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      {refund.manualActionReason}
                    </p>
                  ) : null}
                </div>

                {canManage && canReconcile ? (
                  <ReconcileRefundButton
                    orderId={orderId}
                    refundId={refund.id}
                  />
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {!canManage ? (
        <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-zinc-400">
          Your staff role can view refunds but cannot issue or reconcile them.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Issue PayFast refund</DialogTitle>
            <DialogDescription>
              Refund all or part of the remaining paid balance for {orderNumber}.
              A credit note is created only after PayFast confirms the refund.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <RefundForm
              currency={currency}
              idempotencyKey={idempotencyKey}
              key={idempotencyKey}
              lines={lines}
              orderId={orderId}
              orderNumber={orderNumber}
              refundableBalanceCents={refundableBalanceCents}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
