"use client";

import { useActionState, useEffect, useState } from "react";

import {
  bookCourierGuyShipmentAction,
  cancelCourierGuyShipmentAction,
  quoteCourierGuyShipmentAction,
  reconcileCourierGuyBookingAction,
  refreshCourierGuyShipmentAction,
  saveCourierGuyShipmentParcelAction,
  type CourierGuyQuoteActionState,
  type ShippingActionState,
} from "@/app/(admin)/admin/(dashboard)/shipping/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const initialState: ShippingActionState = { message: "", ok: false };
const initialQuoteState: CourierGuyQuoteActionState = {
  message: "",
  ok: false,
  quote: null,
};
const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  currency: "ZAR",
  style: "currency",
});

function money(value: number) {
  return moneyFormatter.format(value);
}

function metric(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 3,
  }).format(value);
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  );
}

function ShipmentActionForm({
  action,
  confirmMessage,
  label,
  shipmentId,
  variant = "outline",
}: {
  action: typeof bookCourierGuyShipmentAction;
  confirmMessage?: string;
  label: string;
  shipmentId: string;
  variant?: "destructive" | "outline";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-1"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <Button
        type="submit"
        size="sm"
        variant={variant}
        disabled={isPending}
      >
        {isPending ? "Working…" : label}
      </Button>
      {state.message ? (
        <span
          aria-live="polite"
          className={
            state.ok
              ? "max-w-56 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300"
              : "max-w-56 text-[11px] leading-4 text-red-700 dark:text-red-300"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function BookingReconciliationForm({
  bookingReference,
  shipmentId,
}: {
  bookingReference: string;
  shipmentId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    reconcileCourierGuyBookingAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid max-w-80 gap-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <p className="text-xs leading-4 text-amber-700 dark:text-amber-300">
        Search The Courier Guy portal for customer reference{" "}
        <span className="font-semibold break-all">{bookingReference}</span>,
        then enter the matching tracking reference.
      </p>
      <label
        className="text-xs font-medium text-foreground"
        htmlFor={`tracking-reference-${shipmentId}`}
      >
        Courier Guy tracking reference
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <Input
          className="h-9 min-w-44 flex-1"
          disabled={isPending}
          id={`tracking-reference-${shipmentId}`}
          maxLength={160}
          name="trackingReference"
          placeholder="e.g. TCG123456"
          required
        />
        <Button
          className="h-9"
          disabled={isPending}
          size="sm"
          type="submit"
          variant="outline"
        >
          {isPending ? "Verifying…" : "Verify & adopt"}
        </Button>
      </div>
      {state.message ? (
        <span
          aria-live="polite"
          className={
            state.ok
              ? "text-[11px] leading-4 text-emerald-700 dark:text-emerald-300"
              : "text-[11px] leading-4 text-red-700 dark:text-red-300"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function ParcelDetailsDialog({
  orderNumber,
  packedParcel,
  shipmentId,
}: {
  orderNumber: string;
  packedParcel: {
    heightMm: number;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  } | null;
  shipmentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    saveCourierGuyShipmentParcelAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {packedParcel ? "Edit parcel" : "Add parcel details"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-slate-200 bg-white text-zinc-950 shadow-2xl sm:max-w-lg dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>
              {packedParcel ? "Edit packed parcel" : "Add packed parcel"}
            </DialogTitle>
            <DialogDescription>
              Enter the parcel as it will be handed to The Courier Guy for order{" "}
              {orderNumber}. These measurements determine the live provider cost.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="contents">
            <DialogBody className="grid gap-4">
              <input type="hidden" name="shipmentId" value={shipmentId} />
              <div className="grid gap-2">
                <Label htmlFor={`weight-${shipmentId}`}>
                  Packed weight (grams) <RequiredMark />
                </Label>
                <Input
                  defaultValue={packedParcel?.weightGrams ?? ""}
                  disabled={isPending}
                  id={`weight-${shipmentId}`}
                  inputMode="decimal"
                  max={10_000_000}
                  min="0.001"
                  name="weightGrams"
                  required
                  step="0.001"
                  type="number"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["lengthMm", "Packed length (mm)", packedParcel?.lengthMm],
                  ["widthMm", "Packed width (mm)", packedParcel?.widthMm],
                  ["heightMm", "Packed height (mm)", packedParcel?.heightMm],
                ].map(([name, label, value]) => (
                  <div className="grid min-w-0 gap-2" key={String(name)}>
                    <Label htmlFor={`${String(name)}-${shipmentId}`}>
                      {String(label)} <RequiredMark />
                    </Label>
                    <Input
                      defaultValue={value ?? ""}
                      disabled={isPending}
                      id={`${String(name)}-${shipmentId}`}
                      inputMode="decimal"
                      max={100_000}
                      min="0.001"
                      name={String(name)}
                      required
                      step="0.001"
                      type="number"
                    />
                  </div>
                ))}
              </div>
              {state.message && !state.ok ? (
                <Alert variant="destructive">
                  <AlertTitle>Parcel details were not saved</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? "Saving…" : "Save parcel details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingConfirmationForm({
  allowed,
  expired,
  providerAmount,
  quoteId,
  shipmentId,
}: {
  allowed: boolean;
  expired: boolean;
  providerAmount: number;
  quoteId: string;
  shipmentId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    bookCourierGuyShipmentAction,
    initialState,
  );
  const requiresFreshQuote = expired || state.requiresFreshQuote === true;
  const bookingBlocked = expired || state.bookingBlocked === true;
  const caution = state.caution === true;
  const buttonLabel = isPending
    ? "Rechecking & booking…"
    : requiresFreshQuote
      ? "Fresh quote required"
      : bookingBlocked
        ? "Booking stopped"
        : `Confirm & book – ${money(providerAmount)}`;

  return (
    <div className="contents">
      {state.message ? (
        <div className="w-full sm:mr-auto sm:max-w-sm" aria-live="polite">
          <Alert
            className={cn(
              state.ok &&
                !caution &&
                "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
              caution &&
                "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
            )}
            variant={state.ok ? "default" : "destructive"}
          >
            <AlertTitle>
              {caution
                ? "Booked with a cost warning"
                : state.ok
                  ? "Booking completed"
                  : requiresFreshQuote
                    ? "Fresh quote required"
                    : "Booking stopped"}
            </AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <Button
          className="w-full sm:w-auto"
          disabled={!allowed || isPending || state.ok || bookingBlocked}
          type="submit"
        >
          {buttonLabel}
        </Button>
      </form>
    </div>
  );
}

function CourierGuyQuoteBookingFlow({
  orderNumber,
  packedParcel,
  parcelCount,
  shipmentId,
}: {
  orderNumber: string;
  packedParcel: {
    heightMm: number;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  } | null;
  parcelCount: number;
  shipmentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [expiredQuoteId, setExpiredQuoteId] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    quoteCourierGuyShipmentAction,
    initialQuoteState,
  );

  useEffect(() => {
    if (state.quote) {
      setOpen(true);
    }
  }, [state.quote]);

  useEffect(() => {
    const quote = state.quote;

    if (!quote) {
      return;
    }

    const expiresInMs = Math.max(
      0,
      new Date(quote.expiresAt).getTime() - Date.now(),
    );
    const timeoutId = window.setTimeout(() => {
      setExpiredQuoteId(quote.quoteId);
    }, expiresInMs);

    return () => window.clearTimeout(timeoutId);
  }, [state.quote]);

  if (parcelCount !== 1 || !packedParcel) {
    return (
      <div className="grid max-w-64 gap-2">
        <div className="flex flex-wrap gap-2">
          <Button disabled size="sm" variant="outline">
            Get quote
          </Button>
          {parcelCount === 0 ? (
            <ParcelDetailsDialog
              orderNumber={orderNumber}
              packedParcel={null}
              shipmentId={shipmentId}
            />
          ) : null}
        </div>
        <span className="text-[11px] leading-4 text-amber-700 dark:text-amber-300">
          {parcelCount === 0
            ? "Add the packed parcel measurements before requesting a live quote."
            : `This shipment has ${parcelCount} parcels and needs manual review; Courier Guy drop-off quoting requires exactly one.`}
        </span>
      </div>
    );
  }

  const quote = state.quote;
  const quoteExpired = Boolean(quote && expiredQuoteId === quote.quoteId);
  const hasAbsorbedCost = Boolean(quote && quote.projectedAbsorbedAmount > 0);
  const expiryLabel = quote
    ? `${new Intl.DateTimeFormat("en-ZA", {
        dateStyle: "medium",
        timeZone: "Africa/Johannesburg",
        timeStyle: "short",
      }).format(new Date(quote.expiresAt))} SAST`
    : "";

  return (
    <div className="grid max-w-64 gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <Button disabled={isPending} size="sm" type="submit" variant="outline">
            {isPending ? "Getting quote…" : "Get quote"}
          </Button>
        </form>
        <ParcelDetailsDialog
          orderNumber={orderNumber}
          packedParcel={packedParcel}
          shipmentId={shipmentId}
        />
      </div>
      {state.message && !state.quote ? (
        <span
          aria-live="polite"
          className="text-[11px] leading-4 text-red-700 dark:text-red-300"
        >
          {state.message}
        </span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        {quote ? (
          <DialogContent className="border border-slate-200 bg-white text-zinc-950 shadow-2xl sm:max-w-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
            <DialogHeader>
              <DialogTitle>Review Courier Guy quote</DialogTitle>
              <DialogDescription>
                Order {quote.orderNumber}. The customer&apos;s paid delivery amount
                will not change.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              {quoteExpired ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTitle>Quote expired</AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    Get a fresh live quote before confirming this booking.
                  </AlertDescription>
                </Alert>
              ) : null}
              {!quote.allowed ? (
                <Alert variant="destructive">
                  <AlertTitle>Booking blocked by a safety limit</AlertTitle>
                  <AlertDescription>
                    {quote.safetyReason === "booking_cost_limit_exceeded"
                      ? `This ${money(quote.providerAmount)} quote exceeds the ${money(quote.maxBookingCostAmount ?? 0)} per-shipment limit.`
                      : `This order would make Jurgens absorb ${money(quote.projectedAbsorbedAmount)}, above the ${money(quote.maxAbsorbedAmount ?? 0)} limit.`}
                  </AlertDescription>
                </Alert>
              ) : null}
              {quote.unquotedOtherCourierShipments > 0 ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTitle>Order projection is not final</AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    {quote.unquotedOtherCourierShipments} other Courier Guy
                    shipment
                    {quote.unquotedOtherCourierShipments === 1 ? "" : "s"} on
                    this order still need a quote.
                  </AlertDescription>
                </Alert>
              ) : null}

              <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-950 dark:text-white">
                        {quote.serviceName}
                      </p>
                      <Badge variant="secondary">{quote.serviceCode}</Badge>
                    </div>
                    {quote.serviceDescription ? (
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-400">
                        {quote.serviceDescription}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {money(quote.providerAmount)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      VAT inclusive
                    </p>
                  </div>
                </div>
                {quote.estimatedDeliveryFrom || quote.estimatedDeliveryTo ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                    Provider estimate: {quote.estimatedDeliveryFrom ?? "—"} to{" "}
                    {quote.estimatedDeliveryTo ?? "—"}
                  </p>
                ) : null}
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Customer paid for order delivery", money(quote.customerShippingAmount)],
                  ["Other booked carrier costs", money(quote.otherProviderCosts)],
                  ["Projected total carrier spend", money(quote.projectedProviderSpend)],
                  [
                    hasAbsorbedCost
                      ? "Jurgens absorbs"
                      : "Delivery margin remaining",
                    money(
                      hasAbsorbedCost
                        ? quote.projectedAbsorbedAmount
                        : quote.deliveryMarginRemaining,
                    ),
                  ],
                ].map(([label, value], index) => (
                  <div
                    className={cn(
                      "min-w-0 rounded-lg border border-slate-200 p-3 dark:border-white/10",
                      index === 3 && hasAbsorbedCost
                        ? "border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
                        : "",
                    )}
                    key={label}
                  >
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {label}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <section className="grid gap-2 rounded-lg border border-slate-200 p-4 text-xs text-slate-600 sm:grid-cols-2 dark:border-white/10 dark:text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-950 dark:text-white">
                    Packed parcel:
                  </span>{" "}
                  {metric(quote.parcel.weightGrams)} g ·{" "}
                  {metric(quote.parcel.lengthMm)} × {metric(quote.parcel.widthMm)} ×{" "}
                  {metric(quote.parcel.heightMm)} mm
                </p>
                <p>
                  <span className="font-medium text-zinc-950 dark:text-white">
                    Destination:
                  </span>{" "}
                  {quote.destination}
                </p>
                <p className="sm:col-span-2">
                  <span className="font-medium text-zinc-950 dark:text-white">
                    Quote expires:
                  </span>{" "}
                  {expiryLabel}
                </p>
              </section>
            </DialogBody>
            <DialogFooter className="items-stretch sm:items-center sm:justify-between">
              <form action={formAction}>
                <input type="hidden" name="shipmentId" value={shipmentId} />
                <Button
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  type="submit"
                  variant="outline"
                >
                  {isPending ? "Refreshing…" : "Get fresh quote"}
                </Button>
              </form>
              <BookingConfirmationForm
                allowed={quote.allowed}
                expired={quoteExpired}
                key={quote.quoteId}
                providerAmount={quote.providerAmount}
                quoteId={quote.quoteId}
                shipmentId={shipmentId}
              />
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

export function CourierGuyShipmentActions({
  bookingReference,
  orderNumber,
  packedParcel,
  parcelCount,
  shipmentId,
  status,
  trackingNumber,
}: {
  bookingReference: string;
  orderNumber: string;
  packedParcel: {
    heightMm: number;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  } | null;
  parcelCount: number;
  shipmentId: string;
  status: string;
  trackingNumber: string | null;
}) {
  if (status === "pending_booking") {
    return (
      <CourierGuyQuoteBookingFlow
        orderNumber={orderNumber}
        packedParcel={packedParcel}
        parcelCount={parcelCount}
        shipmentId={shipmentId}
      />
    );
  }

  if (status === "booking") {
    return (
      <BookingReconciliationForm
        bookingReference={bookingReference}
        shipmentId={shipmentId}
      />
    );
  }

  if (
    trackingNumber &&
    !["cancelled", "delivered", "returned", "undeliverable"].includes(status)
  ) {
    const canCancel = ["booked", "waybill_ready"].includes(status);

    return (
      <div className="flex flex-wrap items-start gap-2">
        <ShipmentActionForm
          action={refreshCourierGuyShipmentAction}
          label="Refresh tracking"
          shipmentId={shipmentId}
        />
        {canCancel ? (
          <ShipmentActionForm
            action={cancelCourierGuyShipmentAction}
            confirmMessage="Cancel this Courier Guy shipment before it is handed over?"
            label="Cancel"
            shipmentId={shipmentId}
            variant="destructive"
          />
        ) : status === "cancelling" ? (
          <span className="max-w-48 text-xs leading-4 text-amber-700 dark:text-amber-300">
            Cancellation awaits tracking confirmation.
          </span>
        ) : null}
      </div>
    );
  }

  return null;
}
