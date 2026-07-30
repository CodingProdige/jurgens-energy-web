"use client";

import { useActionState } from "react";

import {
  bookCourierGuyShipmentAction,
  cancelCourierGuyShipmentAction,
  reconcileCourierGuyBookingAction,
  refreshCourierGuyShipmentAction,
  type ShippingActionState,
} from "@/app/(admin)/admin/(dashboard)/shipping/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ShippingActionState = { message: "", ok: false };

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

export function CourierGuyShipmentActions({
  bookingReference,
  shipmentId,
  status,
  trackingNumber,
}: {
  bookingReference: string;
  shipmentId: string;
  status: string;
  trackingNumber: string | null;
}) {
  if (status === "pending_booking") {
    return (
      <ShipmentActionForm
        action={bookCourierGuyShipmentAction}
        label="Book & create waybill"
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
