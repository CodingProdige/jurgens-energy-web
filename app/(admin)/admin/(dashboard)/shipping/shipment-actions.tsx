"use client";

import { useActionState } from "react";

import {
  bookCourierGuyShipmentAction,
  cancelCourierGuyShipmentAction,
  refreshCourierGuyShipmentAction,
  type ShippingActionState,
} from "@/app/(admin)/admin/(dashboard)/shipping/actions";
import { Button } from "@/components/ui/button";

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
      <span className="max-w-56 text-xs leading-4 text-amber-700 dark:text-amber-300">
        Booking outcome needs reconciliation. Search the portal for{" "}
        {bookingReference}.
      </span>
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
