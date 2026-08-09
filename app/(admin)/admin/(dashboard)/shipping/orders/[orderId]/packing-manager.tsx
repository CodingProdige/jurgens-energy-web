"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  LoaderCircleIcon,
  PackageIcon,
  PackagePlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TruckIcon,
} from "lucide-react";

import {
  confirmCourierGuyManualPackingOrderAction,
  quoteCourierGuyManualPackingOrderAction,
  saveCourierGuyManualPackingPlanAction,
  type CourierGuyOrderBookingActionState,
  type CourierGuyOrderQuoteActionState,
  type ManualPackingActionState,
} from "@/app/(admin)/admin/(dashboard)/shipping/orders/[orderId]/actions";
import { dashboardPanelClass } from "@/components/dashboard/dashboard-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import type { CourierGuyManualPackingOrder } from "@/src/modules/shipping/courier-guy-manual-packing";
import type {
  CourierGuyOrderBookingQuoteView,
  CourierGuyOrderBookingResult,
} from "@/src/modules/shipping/courier-guy-order-booking";

const initialMutationState: ManualPackingActionState = {
  message: "",
  ok: false,
};
const initialQuoteState: CourierGuyOrderQuoteActionState = {
  message: "",
  ok: false,
  quote: null,
};
const initialBookingState: CourierGuyOrderBookingActionState = {
  message: "",
  ok: false,
  result: null,
};

type PackingItem = CourierGuyManualPackingOrder["items"][number];
type SavedPackage = CourierGuyManualPackingOrder["packages"][number];

type DraftPackage = {
  allocations: Record<string, string>;
  clientId: string;
  heightMm: string;
  lengthMm: string;
  shipmentId: string | null;
  weightGrams: string;
  widthMm: string;
};

type PackingValidation = {
  allocatedByItemId: Map<string, number>;
  fieldErrors: Set<string>;
  messages: string[];
  packageUnitCounts: number[];
};

type BookingOutcome = {
  message: string;
  result: CourierGuyOrderBookingResult | null;
};

function createClientId() {
  return `package-${crypto.randomUUID()}`;
}

function editableMetric(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function buildDraftPackages(
  packages: CourierGuyManualPackingOrder["packages"],
  items: CourierGuyManualPackingOrder["items"],
): DraftPackage[] {
  return packages.map((packingPackage) => ({
    allocations: Object.fromEntries(
      items.map((item) => {
        const allocation = packingPackage.items.find(
          (entry) => entry.orderItemId === item.id,
        );

        return [item.id, allocation ? String(allocation.quantity) : ""];
      }),
    ),
    clientId: `saved-${packingPackage.shipmentId}`,
    heightMm: editableMetric(packingPackage.parcel.heightMm),
    lengthMm: editableMetric(packingPackage.parcel.lengthMm),
    shipmentId: packingPackage.shipmentId,
    weightGrams: editableMetric(packingPackage.parcel.weightGrams),
    widthMm: editableMetric(packingPackage.parcel.widthMm),
  }));
}

function emptyPackage(items: readonly PackingItem[]): DraftPackage {
  return {
    allocations: Object.fromEntries(items.map((item) => [item.id, ""])),
    clientId: createClientId(),
    heightMm: "",
    lengthMm: "",
    shipmentId: null,
    weightGrams: "",
    widthMm: "",
  };
}

function parseAllocation(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function isPositiveMetric(value: string) {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
}

function validatePackingPlan(
  packages: readonly DraftPackage[],
  items: readonly PackingItem[],
): PackingValidation {
  const allocatedByItemId = new Map(items.map((item) => [item.id, 0]));
  const fieldErrors = new Set<string>();
  const messages: string[] = [];
  const packageUnitCounts: number[] = [];

  if (packages.length === 0) {
    messages.push("Add at least one physical package.");
  }

  packages.forEach((packingPackage, packageIndex) => {
    const packageNumber = packageIndex + 1;
    let packageUnits = 0;
    const sellerIds = new Set<string>();

    (["weightGrams", "lengthMm", "widthMm", "heightMm"] as const).forEach(
      (field) => {
        if (!isPositiveMetric(packingPackage[field])) {
          fieldErrors.add(`${packingPackage.clientId}-${field}`);
          messages.push(
            `Package ${packageNumber} needs a positive packed ${field === "weightGrams" ? "weight" : field.replace("Mm", "").toLowerCase()}.`,
          );
        }
      },
    );

    items.forEach((item) => {
      const quantity = parseAllocation(packingPackage.allocations[item.id] ?? "");

      if (!Number.isFinite(quantity)) {
        fieldErrors.add(`${packingPackage.clientId}-item-${item.id}`);
        messages.push(
          `Package ${packageNumber} has an invalid quantity for ${item.title}.`,
        );
        return;
      }

      if (quantity > 0) {
        packageUnits += quantity;
        sellerIds.add(item.sellerId ?? "unassigned-seller");
        allocatedByItemId.set(
          item.id,
          (allocatedByItemId.get(item.id) ?? 0) + quantity,
        );
      }
    });

    if (packageUnits === 0) {
      fieldErrors.add(`${packingPackage.clientId}-items`);
      messages.push(`Package ${packageNumber} must contain at least one item.`);
    }

    if (sellerIds.size > 1) {
      fieldErrors.add(`${packingPackage.clientId}-items`);
      messages.push(
        `Package ${packageNumber} mixes items from different sellers. Split them into separate packages.`,
      );
    }

    packageUnitCounts.push(packageUnits);
  });

  items.forEach((item) => {
    const allocated = allocatedByItemId.get(item.id) ?? 0;

    if (allocated !== item.quantity) {
      fieldErrors.add(`order-item-${item.id}`);
      messages.push(
        allocated < item.quantity
          ? `${item.title}: ${item.quantity - allocated} unit${item.quantity - allocated === 1 ? " is" : "s are"} still unpacked.`
          : `${item.title}: over-allocated by ${allocated - item.quantity} unit${allocated - item.quantity === 1 ? "" : "s"}.`,
      );
    }
  });

  return {
    allocatedByItemId,
    fieldErrors,
    messages: [...new Set(messages)],
    packageUnitCounts,
  };
}

function serializePackingPlan(packages: readonly DraftPackage[]) {
  return packages.map((packingPackage) => ({
    heightMm: Number(packingPackage.heightMm),
    items: Object.entries(packingPackage.allocations)
      .map(([orderItemId, value]) => ({
        orderItemId,
        quantity: parseAllocation(value),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0),
    lengthMm: Number(packingPackage.lengthMm),
    weightGrams: Number(packingPackage.weightGrams),
    widthMm: Number(packingPackage.widthMm),
  }));
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(value);
}

function metric(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 3,
  }).format(value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function formatDestination(
  address: CourierGuyManualPackingOrder["order"]["deliveryAddress"],
) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  );
}

function MutationAlert({ state }: { state: ManualPackingActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <Alert
      aria-live="polite"
      className={cn(
        state.ok &&
          "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
      variant={state.ok ? "default" : "destructive"}
    >
      <AlertTitle>{state.ok ? "Packing plan saved" : "Packing plan not saved"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function PackingSteps({
  booked,
  planSaved,
  quoted,
}: {
  booked: boolean;
  planSaved: boolean;
  quoted: boolean;
}) {
  const steps = [
    { complete: planSaved, label: "Pack", number: 1 },
    { complete: quoted, label: "Review live quotes", number: 2 },
    { complete: booked, label: "Book", number: 3 },
  ];

  return (
    <ol
      aria-label="Packing and booking progress"
      className={cn(
        "grid gap-2 p-3 sm:grid-cols-3",
        dashboardPanelClass,
      )}
    >
      {steps.map((step, index) => {
        const active = !step.complete && steps.slice(0, index).every((item) => item.complete);

        return (
          <li
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2",
              step.complete
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10"
                : active
                  ? "border-[#ff5a1f]/40 bg-[#ff5a1f]/5"
                  : "border-slate-200 dark:border-white/10",
            )}
            key={step.number}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                step.complete
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-[#ff5a1f] text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400",
              )}
            >
              {step.complete ? (
                <CheckCircle2Icon aria-hidden="true" className="size-4" />
              ) : (
                step.number
              )}
            </span>
            <span className="min-w-0 text-sm font-semibold">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderItemReference({
  allocated,
  item,
}: {
  allocated: number;
  item: PackingItem;
}) {
  const remaining = item.quantity - allocated;
  const hasReference = [
    item.currentParcelReference.weightGrams,
    item.currentParcelReference.lengthMm,
    item.currentParcelReference.widthMm,
    item.currentParcelReference.heightMm,
  ].every((value) => value !== null && value !== undefined && value > 0);

  return (
    <article
      className={cn(
        "grid min-w-0 gap-2 rounded-lg border p-3",
        remaining === 0
          ? "border-slate-200 dark:border-white/10"
          : "border-amber-300 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-500/10",
      )}
      data-packing-invalid={remaining === 0 ? undefined : "true"}
      id={`order-item-${item.id}`}
      tabIndex={-1}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
            {item.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {item.sku ? `SKU ${item.sku} · ` : ""}Ordered {item.quantity}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <p className="font-semibold text-zinc-950 dark:text-white">
            {allocated} / {item.quantity} packed
          </p>
          <p
            className={cn(
              "mt-0.5",
              remaining === 0
                ? "text-emerald-700 dark:text-emerald-300"
                : remaining > 0
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300",
            )}
          >
            {remaining === 0
              ? "Fully allocated"
              : remaining > 0
                ? `${remaining} remaining`
                : `${Math.abs(remaining)} over`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.currentParcelReference.shipsAlone ? (
          <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200" variant="outline">
            Ships alone
          </Badge>
        ) : null}
        {item.currentParcelReference.isFragile ? (
          <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200" variant="outline">
            Fragile
          </Badge>
        ) : null}
      </div>
      <p className="text-[11px] leading-4 text-slate-500 dark:text-zinc-400">
        <span className="font-semibold text-slate-700 dark:text-zinc-300">
          Product reference only:
        </span>{" "}
        {hasReference
          ? `${metric(item.currentParcelReference.weightGrams)} g · ${metric(item.currentParcelReference.lengthMm)} × ${metric(item.currentParcelReference.widthMm)} × ${metric(item.currentParcelReference.heightMm)} mm per unit`
          : "No complete saved product measurements. Measure the packed parcel physically."}
      </p>
    </article>
  );
}

function metricFieldLabel(field: keyof Pick<DraftPackage, "weightGrams" | "lengthMm" | "widthMm" | "heightMm">) {
  switch (field) {
    case "weightGrams":
      return "Actual packed weight (g)";
    case "lengthMm":
      return "Packed length (mm)";
    case "widthMm":
      return "Packed width (mm)";
    case "heightMm":
      return "Packed height (mm)";
  }
}

function PackageEditor({
  allocatedByItemId,
  canEdit,
  index,
  items,
  onAllocationChange,
  onMetricChange,
  onRemove,
  packingPackage,
  savedPackage,
  showValidation,
  unitCount,
  validation,
}: {
  allocatedByItemId: Map<string, number>;
  canEdit: boolean;
  index: number;
  items: readonly PackingItem[];
  onAllocationChange: (packageId: string, itemId: string, value: string) => void;
  onMetricChange: (
    packageId: string,
    field: "weightGrams" | "lengthMm" | "widthMm" | "heightMm",
    value: string,
  ) => void;
  onRemove: (packingPackage: DraftPackage) => void;
  packingPackage: DraftPackage;
  savedPackage: SavedPackage | null;
  showValidation: boolean;
  unitCount: number;
  validation: PackingValidation;
}) {
  const packageNumber = index + 1;
  const itemGroupInvalid = validation.fieldErrors.has(
    `${packingPackage.clientId}-items`,
  );

  return (
    <fieldset
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-white dark:bg-[#151719]",
        showValidation && itemGroupInvalid
          ? "border-red-400 dark:border-red-400/50"
          : "border-slate-300 dark:border-white/18",
      )}
    >
      <legend className="sr-only">Package {packageNumber}</legend>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="font-semibold text-zinc-950 outline-none dark:text-white"
              id={`packing-heading-${packingPackage.clientId}`}
              tabIndex={-1}
            >
              Package {packageNumber}
            </h3>
            {savedPackage ? (
              <Badge className="capitalize" variant="secondary">
                {humanize(savedPackage.shipmentStatus)}
              </Badge>
            ) : (
              <Badge variant="outline">Unsaved</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {unitCount} unit{unitCount === 1 ? "" : "s"} assigned
          </p>
        </div>
        {canEdit ? (
          <Button
            aria-label={`Remove package ${packageNumber}`}
            onClick={() => onRemove(packingPackage)}
            size="sm"
            type="button"
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" className="size-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-5 p-4">
        <section aria-labelledby={`measurements-${packingPackage.clientId}`}>
          <h4
            className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400"
            id={`measurements-${packingPackage.clientId}`}
          >
            Final physical measurements
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Measure the sealed parcel that will be handed to The Courier Guy.
            These values determine actual and volumetric rating.
          </p>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {(
              ["weightGrams", "lengthMm", "widthMm", "heightMm"] as const
            ).map((field) => {
              const inputId = `${packingPackage.clientId}-${field}`;
              const invalid = validation.fieldErrors.has(inputId);

              return (
                <div className="grid min-w-0 gap-1.5" key={field}>
                  <Label htmlFor={inputId}>
                    {metricFieldLabel(field)} <RequiredMark />
                  </Label>
                  <Input
                    aria-describedby={`${inputId}-help`}
                    aria-invalid={showValidation && invalid}
                    className="h-10"
                    data-packing-invalid={
                      showValidation && invalid ? "true" : undefined
                    }
                    disabled={!canEdit}
                    id={inputId}
                    inputMode="decimal"
                    max={field === "weightGrams" ? 10_000_000 : 100_000}
                    min="0.001"
                    name={`packages.${index}.${field}`}
                    onChange={(event) =>
                      onMetricChange(
                        packingPackage.clientId,
                        field,
                        event.target.value,
                      )
                    }
                    required
                    step="0.001"
                    type="number"
                    value={packingPackage[field]}
                  />
                  <span className="sr-only" id={`${inputId}-help`}>
                    Enter the final packed {field === "weightGrams" ? "weight in grams" : `${field.replace("Mm", "").toLowerCase()} in millimetres`}.
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby={`allocations-${packingPackage.clientId}`}
          className="grid min-w-0 gap-3"
        >
          <div>
            <h4
              className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400"
              id={`allocations-${packingPackage.clientId}`}
            >
              Contents of this package
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Enter exactly how many units of each order line are physically in
              this package. Zero or blank means none.
            </p>
          </div>
          {items.map((item) => {
            const inputId = `${packingPackage.clientId}-item-${item.id}`;
            const current = parseAllocation(
              packingPackage.allocations[item.id] ?? "",
            );
            const currentQuantity = Number.isFinite(current) ? current : 0;
            const allocatedEverywhere = allocatedByItemId.get(item.id) ?? 0;
            const allocatedElsewhere = allocatedEverywhere - currentQuantity;
            const maxForPackage = Math.max(0, item.quantity - allocatedElsewhere);
            const remainingAfter = item.quantity - allocatedElsewhere - currentQuantity;
            const invalid = validation.fieldErrors.has(inputId);

            return (
              <div
                className="grid min-w-0 gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center dark:border-white/10"
                key={item.id}
              >
                <div className="min-w-0">
                  <Label className="font-semibold" htmlFor={inputId}>
                    {item.title}
                  </Label>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    {item.sku ? `${item.sku} · ` : ""}
                    {Math.max(0, remainingAfter)} unit
                    {Math.max(0, remainingAfter) === 1 ? "" : "s"} remain after
                    this package
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Input
                    aria-label={`Quantity of ${item.title} in package ${packageNumber}`}
                    aria-invalid={showValidation && invalid}
                    className="h-10 text-right tabular-nums"
                    data-packing-invalid={
                      showValidation && invalid ? "true" : undefined
                    }
                    disabled={!canEdit}
                    id={inputId}
                    inputMode="numeric"
                    max={maxForPackage}
                    min={0}
                    name={`packages.${index}.items.${item.id}`}
                    onChange={(event) =>
                      onAllocationChange(
                        packingPackage.clientId,
                        item.id,
                        event.target.value,
                      )
                    }
                    step={1}
                    type="number"
                    value={packingPackage.allocations[item.id] ?? ""}
                  />
                </div>
              </div>
            );
          })}
          {showValidation && itemGroupInvalid ? (
            <p className="text-xs leading-5 text-red-700 dark:text-red-300">
              This package must contain at least one item and may not mix
              different sellers.
            </p>
          ) : null}
        </section>
      </div>
    </fieldset>
  );
}

function BookingResultPanel({
  currency,
  expired,
  onOutcome,
  orderId,
  quote,
}: {
  currency: string;
  expired: boolean;
  onOutcome: (outcome: BookingOutcome) => void;
  orderId: string;
  quote: CourierGuyOrderBookingQuoteView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    confirmCourierGuyManualPackingOrderAction,
    initialBookingState,
  );

  useEffect(() => {
    if (state.result || (!state.ok && state.message)) {
      setOpen(false);
      onOutcome({ message: state.message, result: state.result });
      router.refresh();
    }
  }, [onOutcome, router, state.message, state.ok, state.result]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {expired ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            The reviewed quotes expired. Request fresh quotes before booking.
          </p>
        ) : null}
        <Button
          className="h-10 sm:w-auto"
          disabled={!quote.allowed || expired}
          onClick={() => setOpen(true)}
          type="button"
        >
          <TruckIcon aria-hidden="true" className="size-4" />
          {`Confirm & book ${quote.packages.length} package${quote.packages.length === 1 ? "" : "s"} – ${money(quote.totals.quotedProviderAmount, currency)}`}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-slate-200 bg-white text-zinc-950 shadow-2xl sm:max-w-xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Confirm provider bookings</DialogTitle>
            <DialogDescription>
              This creates real Courier Guy bookings and waybills. The
              customer&apos;s delivery charge remains fixed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              <ShieldAlertIcon aria-hidden="true" />
              <AlertTitle>Review the total before continuing</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                You are approving {quote.packages.length} provider booking
                {quote.packages.length === 1 ? "" : "s"} quoted at a combined{" "}
                {money(quote.totals.quotedProviderAmount, currency)}. Provider
                calls may complete one package at a time; any mixed result will
                be shown individually.
              </AlertDescription>
            </Alert>
            <dl className="grid gap-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Customer paid</dt>
                <dd className="font-semibold tabular-nums">
                  {money(quote.totals.customerShippingAmount, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Projected carrier spend</dt>
                <dd className="font-semibold tabular-nums">
                  {money(quote.totals.projectedProviderSpend, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-white/10">
                <dt className="font-semibold">
                  {quote.totals.projectedAbsorbedAmount > 0
                    ? "Jurgens absorbs"
                    : "Delivery margin remaining"}
                </dt>
                <dd className="font-bold tabular-nums">
                  {money(
                    quote.totals.projectedAbsorbedAmount > 0
                      ? quote.totals.projectedAbsorbedAmount
                      : quote.totals.deliveryMarginRemaining,
                    currency,
                  )}
                </dd>
              </div>
            </dl>
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Go back
            </Button>
            <form action={formAction}>
              <input name="batchId" type="hidden" value={quote.batchId} />
              <input name="orderId" type="hidden" value={orderId} />
              <Button className="w-full" disabled={pending} type="submit">
                {pending ? (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <TruckIcon aria-hidden="true" className="size-4" />
                )}
                {pending
                  ? "Booking packages…"
                  : `Book for ${money(quote.totals.quotedProviderAmount, currency)}`}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LatestBookingOutcome({ outcome }: { outcome: BookingOutcome }) {
  const result = outcome.result;
  const allBooked = Boolean(
    result && result.results.every((item) => item.status === "booked"),
  );
  const needsReconciliation = Boolean(
    result?.status === "needs_reconciliation" ||
      result?.results.some((item) => item.status === "needs_reconciliation") ||
      /reconcil/i.test(outcome.message),
  );

  return (
    <section className={cn("overflow-hidden", dashboardPanelClass)}>
      <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-950 dark:text-white">
            Latest booking result
          </h3>
          <Badge
            className={cn(
              allBooked
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : needsReconciliation
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200",
            )}
            variant="outline"
          >
            {result ? humanize(result.status) : "fresh quote required"}
          </Badge>
        </div>
        <p
          aria-live="polite"
          className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400"
        >
          {outcome.message}
        </p>
      </div>

      {result ? (
        <div className="divide-y divide-slate-200 dark:divide-white/10">
          {result.results.map((booking) => (
            <div
              className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
              key={booking.shipmentId}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Package {booking.sequence}
                </p>
                <p className="mt-0.5 break-words text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  {booking.trackingReference
                    ? `Tracking ${booking.trackingReference}`
                    : booking.message ?? "No tracking reference was returned."}
                </p>
              </div>
              <Badge
                className={cn(
                  "w-fit capitalize",
                  booking.status === "booked"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : booking.status === "needs_reconciliation"
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
                      : "border-red-300 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200",
                )}
                variant="outline"
              >
                {humanize(booking.status)}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}

      {!allBooked ? (
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <p className="leading-5 text-slate-700 dark:text-zinc-300">
            {needsReconciliation
              ? "Do not retry this package. Reconcile the uncertain booking from Shipping first."
              : "The old quote set is retired. Request fresh quotes for the remaining unbooked packages before trying again."}
          </p>
          {needsReconciliation ? (
            <Link
              className={buttonVariants({
                className: "h-9 w-full rounded-md sm:w-auto",
                variant: "outline",
              })}
              href="/shipping"
            >
              Open Shipping
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PersistedBookingRecoveryPanel({
  batch,
  canManage,
  onOutcome,
  orderId,
  packages,
}: {
  batch: NonNullable<CourierGuyManualPackingOrder["activeBookingBatch"]>;
  canManage: boolean;
  onOutcome: (outcome: BookingOutcome) => void;
  orderId: string;
  packages: CourierGuyManualPackingOrder["packages"];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    confirmCourierGuyManualPackingOrderAction,
    initialBookingState,
  );
  const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });

  useEffect(() => {
    if (state.result || (!state.ok && state.message)) {
      onOutcome({ message: state.message, result: state.result });
      router.refresh();
    }
  }, [onOutcome, router, state.message, state.ok, state.result]);

  return (
    <section
      className={cn(
        dashboardPanelClass,
        "grid min-w-0 gap-4 border-amber-300 bg-amber-50/70 p-4 dark:border-amber-400/30 dark:bg-amber-500/10",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200">
          <RefreshCwIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-amber-950 dark:text-amber-100">
              Recover in-progress Courier Guy bookings
            </h2>
            <Badge
              className="border-amber-300 bg-white/70 text-amber-800 dark:border-amber-400/30 dark:bg-black/10 dark:text-amber-200"
              variant="outline"
            >
              {humanize(batch.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-amber-900/85 dark:text-amber-100/80">
            This booking batch was already started and survived the browser
            refresh. Recovery checks persisted provider state first, adopts any
            completed packages, and safely continues only packages that still
            need an attempt.
          </p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/75">
            Started {dateFormatter.format(new Date(batch.createdAt))} SAST ·
            Original quote expiry {dateFormatter.format(new Date(batch.expiresAt))} SAST
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {packages.map((packingPackage) => (
          <div
            className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-amber-300/70 bg-white/70 px-3 py-2 dark:border-amber-400/20 dark:bg-black/10"
            key={packingPackage.shipmentId}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Package {packingPackage.packageSequence}
              </p>
              <p className="text-xs text-amber-800/75 dark:text-amber-200/70">
                {packingPackage.items.reduce(
                  (total, item) => total + item.quantity,
                  0,
                )}{" "}
                unit
                {packingPackage.items.reduce(
                  (total, item) => total + item.quantity,
                  0,
                ) === 1
                  ? ""
                  : "s"}
              </p>
            </div>
            <Badge
              className="max-w-full capitalize"
              variant="outline"
            >
              {humanize(packingPackage.shipmentStatus)}
            </Badge>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
          Do not change the package plan while this recovery is available.
        </p>
        {canManage ? (
          <form action={formAction}>
            <input name="batchId" type="hidden" value={batch.id} />
            <input name="orderId" type="hidden" value={orderId} />
            <Button className="h-10 w-full sm:w-auto" disabled={pending} type="submit">
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon aria-hidden="true" className="size-4" />
              )}
              {pending
                ? "Recovering package bookings…"
                : "Resume/recover in-progress bookings"}
            </Button>
          </form>
        ) : (
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
            Shipment management permission is required to recover this batch.
          </p>
        )}
      </div>
    </section>
  );
}

function QuoteReview({
  currency,
  expired,
  onOutcome,
  orderId,
  quote,
}: {
  currency: string;
  expired: boolean;
  onOutcome: (outcome: BookingOutcome) => void;
  orderId: string;
  quote: CourierGuyOrderBookingQuoteView;
}) {
  const hasAbsorbedCost = quote.totals.projectedAbsorbedAmount > 0;
  const expiryLabel = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(quote.expiresAt));

  return (
    <section className="grid min-w-0 gap-4" id="live-quote-review">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
            Review live package quotes
          </h2>
          <Badge variant={quote.allowed ? "secondary" : "destructive"}>
            {quote.allowed ? "Ready to book" : "Booking blocked"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          These quotes apply only to packing revision {quote.packingRevision} and
          expire {expiryLabel} SAST.
        </p>
      </div>

      {expired ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Quotes expired</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Request fresh quotes before starting new provider bookings.
          </AlertDescription>
        </Alert>
      ) : null}

      {!quote.allowed ? (
        <Alert variant="destructive">
          <ShieldAlertIcon aria-hidden="true" />
          <AlertTitle>Booking blocked by safety limits</AlertTitle>
          <AlertDescription>
            {quote.safetyReasons.length > 0
              ? quote.safetyReasons.map(humanize).join(" · ")
              : "The combined provider cost is outside the configured limits."}
          </AlertDescription>
        </Alert>
      ) : null}

      {quote.maxBookingCostAmount === null && quote.maxAbsorbedAmount === null ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <ShieldAlertIcon aria-hidden="true" />
          <AlertTitle>No automatic cost caps are configured</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            The exact total below still requires your confirmation, but no
            per-package or absorbed-cost ceiling will block it automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        {quote.packages.map((packingPackage) => (
          <article
            className={cn("grid min-w-0 gap-3 p-4", dashboardPanelClass)}
            key={packingPackage.shipmentId}
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-zinc-950 dark:text-white">
                  Package {packingPackage.sequence}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                  {packingPackage.serviceName} · {packingPackage.serviceCode}
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                {money(packingPackage.providerAmount, currency)}
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {metric(packingPackage.parcel.weightGrams)} g ·{" "}
              {metric(packingPackage.parcel.lengthMm)} ×{" "}
              {metric(packingPackage.parcel.widthMm)} ×{" "}
              {metric(packingPackage.parcel.heightMm)} mm
            </p>
            <ul className="grid gap-1 text-xs text-slate-600 dark:text-zinc-300">
              {packingPackage.items.map((item) => (
                <li className="flex min-w-0 justify-between gap-3" key={item.orderItemId}>
                  <span className="min-w-0 truncate">
                    {item.title}{item.sku ? ` · ${item.sku}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">Qty {item.quantity}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <dl className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Customer paid for delivery", quote.totals.customerShippingAmount],
          ["Already committed carrier spend", quote.totals.alreadyCommittedProviderAmount],
          ["New package quotes", quote.totals.quotedProviderAmount],
          ["Projected total carrier spend", quote.totals.projectedProviderSpend],
          [
            hasAbsorbedCost ? "Jurgens absorbs" : "Delivery margin remaining",
            hasAbsorbedCost
              ? quote.totals.projectedAbsorbedAmount
              : quote.totals.deliveryMarginRemaining,
          ],
          [
            "Safety caps",
            `${quote.maxBookingCostAmount === null ? "Per-package off" : money(quote.maxBookingCostAmount, currency)} · ${quote.maxAbsorbedAmount === null ? "Absorbed off" : money(quote.maxAbsorbedAmount, currency)}`,
          ],
        ].map(([label, value], index) => (
          <div
            className={cn(
              "min-w-0 rounded-lg border border-slate-200 p-3 dark:border-white/10",
              index === 4 && hasAbsorbedCost
                ? "border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
                : "",
            )}
            key={String(label)}
          >
            <dt className="text-xs text-slate-500 dark:text-zinc-400">{label}</dt>
            <dd className="mt-1 break-words font-semibold tabular-nums text-zinc-950 dark:text-white">
              {typeof value === "number" ? money(value, currency) : value}
            </dd>
          </div>
        ))}
      </dl>

      <BookingResultPanel
        currency={currency}
        expired={expired}
        onOutcome={onOutcome}
        orderId={orderId}
        quote={quote}
      />
    </section>
  );
}

export function CourierGuyPackingManager({
  data,
  canManage,
}: {
  data: CourierGuyManualPackingOrder;
  canManage: boolean;
}) {
  const router = useRouter();
  const [packages, setPackages] = useState(() =>
    buildDraftPackages(data.packages, data.items),
  );
  const [dirty, setDirty] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<DraftPackage | null>(null);
  const [quoteInvalidated, setQuoteInvalidated] = useState(false);
  const [expiredBatchId, setExpiredBatchId] = useState<string | null>(null);
  const [bookingOutcome, setBookingOutcome] = useState<BookingOutcome | null>(
    null,
  );
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [saveState, saveFormAction, savePending] = useActionState(
    saveCourierGuyManualPackingPlanAction,
    initialMutationState,
  );
  const [quoteState, quoteFormAction, quotePending] = useActionState(
    quoteCourierGuyManualPackingOrderAction,
    initialQuoteState,
  );
  const validation = useMemo(
    () => validatePackingPlan(packages, data.items),
    [data.items, packages],
  );
  const packagePayload = useMemo(
    () => JSON.stringify(serializePackingPlan(packages)),
    [packages],
  );
  const canEdit = canManage && data.editable && !data.activeBookingBatch;
  const planSaved = Boolean(
    data.packingPlan.revision > 0 &&
      !dirty &&
      validation.messages.length === 0,
  );
  const visibleQuote = quoteInvalidated ? null : quoteState.quote;
  const quoteExpired = Boolean(
    visibleQuote && expiredBatchId === visibleQuote.batchId,
  );
  const booked =
    data.packages.length > 0 &&
    data.packages.every((packingPackage) =>
      [
        "booked",
        "waybill_ready",
        "ready_for_collection",
        "collected",
        "in_transit",
        "out_for_delivery",
        "delivered",
      ].includes(packingPackage.shipmentStatus),
    );
  const bookingOutcomeAllBooked = Boolean(
    bookingOutcome?.result &&
      bookingOutcome.result.results.every((item) => item.status === "booked"),
  );
  const bookingOutcomeNeedsReconciliation = Boolean(
    bookingOutcome?.result?.status === "needs_reconciliation" ||
      bookingOutcome?.result?.results.some(
        (item) => item.status === "needs_reconciliation",
      ) ||
      (bookingOutcome && /reconcil/i.test(bookingOutcome.message)),
  );
  const reconciliationRequired =
    data.packingPlan.status === "reconciliation_required" ||
    bookingOutcomeNeedsReconciliation;
  const canQuote =
    canManage &&
    planSaved &&
    ["confirmed", "booking"].includes(data.packingPlan.status) &&
    !booked &&
    !bookingOutcomeAllBooked &&
    !reconciliationRequired &&
    !data.activeBookingBatch;
  const totalOrderedUnits = data.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const totalPackedUnits = [...validation.allocatedByItemId.values()].reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const savedPackageByShipmentId = new Map(
    data.packages.map((packingPackage) => [
      packingPackage.shipmentId,
      packingPackage,
    ]),
  );

  useEffect(() => {
    if (saveState.ok) {
      setDirty(false);
      setShowValidation(false);
      router.refresh();
    }
  }, [router, saveState]);

  useEffect(() => {
    const quote = quoteState.quote;

    if (!quote) {
      return;
    }

    setQuoteInvalidated(false);
    setExpiredBatchId(null);
    setBookingOutcome(null);
    const expiresInMs = Math.max(
      0,
      new Date(quote.expiresAt).getTime() - Date.now(),
    );
    const timeoutId = window.setTimeout(
      () => setExpiredBatchId(quote.batchId),
      expiresInMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [quoteState.quote]);

  const handleBookingOutcome = useCallback((outcome: BookingOutcome) => {
    setBookingOutcome(outcome);
    setQuoteInvalidated(true);
  }, []);

  function markEdited() {
    setDirty(true);
    setQuoteInvalidated(true);
  }

  function addPackage() {
    const nextPackage = emptyPackage(data.items);
    setPackages((current) => [...current, nextPackage]);
    markEdited();

    window.requestAnimationFrame(() => {
      document
        .getElementById(`packing-heading-${nextPackage.clientId}`)
        ?.focus();
    });
  }

  function removePackage(packingPackage: DraftPackage) {
    const unitCount = Object.values(packingPackage.allocations).reduce(
      (total, value) => {
        const quantity = parseAllocation(value);
        return total + (Number.isFinite(quantity) ? quantity : 0);
      },
      0,
    );

    if (unitCount > 0) {
      setRemoveCandidate(packingPackage);
      return;
    }

    setPackages((current) =>
      current.filter((entry) => entry.clientId !== packingPackage.clientId),
    );
    markEdited();
    addButtonRef.current?.focus();
  }

  function confirmRemovePackage() {
    if (!removeCandidate) {
      return;
    }

    setPackages((current) =>
      current.filter((entry) => entry.clientId !== removeCandidate.clientId),
    );
    setRemoveCandidate(null);
    markEdited();
    window.requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  function updateMetric(
    packageId: string,
    field: "weightGrams" | "lengthMm" | "widthMm" | "heightMm",
    value: string,
  ) {
    setPackages((current) =>
      current.map((packingPackage) =>
        packingPackage.clientId === packageId
          ? { ...packingPackage, [field]: value }
          : packingPackage,
      ),
    );
    markEdited();
  }

  function updateAllocation(packageId: string, itemId: string, value: string) {
    setPackages((current) =>
      current.map((packingPackage) =>
        packingPackage.clientId === packageId
          ? {
              ...packingPackage,
              allocations: {
                ...packingPackage.allocations,
                [itemId]: value,
              },
            }
          : packingPackage,
      ),
    );
    markEdited();
  }

  function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    if (validation.messages.length === 0) {
      return;
    }

    event.preventDefault();
    setShowValidation(true);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-packing-invalid='true']")
        ?.focus();
    });
  }

  return (
    <div className="grid min-w-0 gap-5">
      <PackingSteps
        booked={booked || bookingOutcomeAllBooked}
        planSaved={planSaved}
        quoted={Boolean(visibleQuote && !quoteExpired)}
      />

      {!canEdit ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>This packing plan is read only</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {data.editBlockedReason ??
              (canManage
                ? "The package plan can no longer be changed."
                : "You do not have permission to change or book shipments.")}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className={cn("grid min-w-0 gap-4 p-4", dashboardPanelClass)}>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Customer", data.order.customerName],
            ["Destination", formatDestination(data.order.deliveryAddress)],
            ["Customer paid delivery", money(Number(data.order.shippingTotal), data.order.currency)],
            ["Manual package plan", `${packages.length} package${packages.length === 1 ? "" : "s"}`],
          ].map(([label, value]) => (
            <div className="min-w-0" key={String(label)}>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p>
              <p className="mt-1 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <form
        action={saveFormAction}
        className="grid min-w-0 gap-5"
        onSubmit={handlePlanSubmit}
      >
        <input name="orderId" type="hidden" value={data.order.id} />
        <input name="packages" type="hidden" value={packagePayload} />

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.5fr)] xl:items-start">
          <aside className="grid min-w-0 gap-3 xl:sticky xl:top-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
                Order items
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-zinc-400">
                Allocate every ordered unit exactly once. Product measurements
                are references only and never create packages automatically.
              </p>
            </div>
            <div className="grid gap-3">
              {data.items.map((item) => (
                <OrderItemReference
                  allocated={validation.allocatedByItemId.get(item.id) ?? 0}
                  item={item}
                  key={item.id}
                />
              ))}
            </div>
          </aside>

          <section className="grid min-w-0 gap-4" aria-labelledby="physical-packages-heading">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2
                  className="text-lg font-bold text-zinc-950 dark:text-white"
                  id="physical-packages-heading"
                >
                  Physical packages
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-zinc-400">
                  Add only the sealed packages you will physically hand to the
                  courier. Enter each package&apos;s actual final measurements.
                </p>
              </div>
              {canEdit ? (
                <Button
                  className="h-10 w-full sm:w-auto"
                  onClick={addPackage}
                  ref={addButtonRef}
                  type="button"
                  variant="outline"
                >
                  <PackagePlusIcon aria-hidden="true" className="size-4" />
                  Add empty package
                </Button>
              ) : null}
            </div>

            <div
              aria-live="polite"
              className={cn(
                "flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                validation.messages.length === 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
              )}
            >
              <span className="font-semibold">
                {packages.length} package{packages.length === 1 ? "" : "s"} ·{" "}
                {totalPackedUnits}/{totalOrderedUnits} units allocated
              </span>
              <span className="text-xs">
                {validation.messages.length === 0
                  ? "Packing plan is complete"
                  : `${validation.messages.length} issue${validation.messages.length === 1 ? "" : "s"} to resolve`}
              </span>
            </div>

            {packages.length === 0 ? (
              <div className={cn("grid place-items-center gap-3 px-5 py-12 text-center", dashboardPanelClass)}>
                <PackageIcon aria-hidden="true" className="size-8 text-slate-400" />
                <div>
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    No physical packages added
                  </p>
                  <p className="mt-1 max-w-md text-sm leading-5 text-slate-500 dark:text-zinc-400">
                    Start by packing the order, then add one empty package for
                    each sealed parcel. Nothing is generated from product data.
                  </p>
                </div>
              </div>
            ) : (
              packages.map((packingPackage, index) => (
                <PackageEditor
                  allocatedByItemId={validation.allocatedByItemId}
                  canEdit={canEdit}
                  index={index}
                  items={data.items}
                  key={packingPackage.clientId}
                  onAllocationChange={updateAllocation}
                  onMetricChange={updateMetric}
                  onRemove={removePackage}
                  packingPackage={packingPackage}
                  savedPackage={
                    packingPackage.shipmentId
                      ? (savedPackageByShipmentId.get(
                          packingPackage.shipmentId,
                        ) ?? null)
                      : null
                  }
                  showValidation={showValidation}
                  unitCount={validation.packageUnitCounts[index] ?? 0}
                  validation={validation}
                />
              ))
            )}

            {showValidation && validation.messages.length > 0 ? (
              <Alert aria-live="polite" variant="destructive">
                <CircleAlertIcon aria-hidden="true" />
                <AlertTitle>Complete the packing plan</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {validation.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {!dirty || !saveState.ok ? (
              <MutationAlert state={saveState} />
            ) : null}

            {canEdit ? (
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                {dirty ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Unsaved changes invalidate any earlier live quotes.
                  </p>
                ) : null}
                <Button className="h-10 sm:w-auto" disabled={savePending} type="submit">
                  {savePending ? (
                    <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2Icon aria-hidden="true" className="size-4" />
                  )}
                  {savePending ? "Saving plan…" : "Save complete packing plan"}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </form>

      {data.activeBookingBatch &&
      !reconciliationRequired &&
      !bookingOutcome ? (
        <PersistedBookingRecoveryPanel
          batch={data.activeBookingBatch}
          canManage={canManage}
          onOutcome={handleBookingOutcome}
          orderId={data.order.id}
          packages={data.packages}
        />
      ) : null}

      <section className={cn("grid min-w-0 gap-4 p-4", dashboardPanelClass)}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Live quote and booking
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-zinc-400">
              Courier Guy quotes every confirmed physical package. You review
              the combined cost before any booking is created.
            </p>
          </div>
          <form action={quoteFormAction}>
            <input name="orderId" type="hidden" value={data.order.id} />
            <Button
              className="h-10 w-full sm:w-auto"
              disabled={
                !canQuote || quotePending
              }
              type="submit"
              variant="outline"
            >
              {quotePending ? (
                <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon aria-hidden="true" className="size-4" />
              )}
              {quotePending
                ? data.packingPlan.status === "booking" || bookingOutcome
                  ? "Quoting remaining packages…"
                  : "Quoting every package…"
                : visibleQuote
                  ? "Get fresh quotes"
                  : data.packingPlan.status === "booking" || bookingOutcome
                    ? "Get fresh quotes for remaining packages"
                    : "Get live quotes for all packages"}
            </Button>
          </form>
        </div>

        {quoteState.message && !quoteState.quote ? (
          <Alert aria-live="polite" variant={quoteState.ok ? "default" : "destructive"}>
            <AlertTitle>
              {quoteState.ok ? "Quote refreshed" : "Quotes unavailable"}
            </AlertTitle>
            <AlertDescription>{quoteState.message}</AlertDescription>
          </Alert>
        ) : null}

        {dirty ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Save the changed packing plan first</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Any previous quote is invalid because package contents or
              measurements changed.
            </AlertDescription>
          </Alert>
        ) : null}

        {reconciliationRequired ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            <ShieldAlertIcon aria-hidden="true" />
            <AlertTitle>Courier booking reconciliation required</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Do not request another quote or retry the uncertain package. Open
              Shipping and reconcile it against The Courier Guy first.{" "}
              <Link className="font-semibold underline" href="/shipping">
                Open Shipping
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        {bookingOutcome ? (
          <LatestBookingOutcome outcome={bookingOutcome} />
        ) : null}

        {visibleQuote ? (
          <QuoteReview
            currency={data.order.currency}
            expired={quoteExpired}
            onOutcome={handleBookingOutcome}
            orderId={data.order.id}
            quote={visibleQuote}
          />
        ) : !bookingOutcome ? (
          <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/18">
            <TruckIcon aria-hidden="true" className="size-7 text-slate-400" />
            <p className="font-semibold text-zinc-950 dark:text-white">
              No live package quote under review
            </p>
            <p className="max-w-lg text-sm leading-5 text-slate-500 dark:text-zinc-400">
              {data.activeBookingBatch
                ? "Recover the persisted in-progress batch above before requesting another quote."
                : "Save a complete manual packing plan, then request live quotes to see each package cost and the combined delivery exposure."}
            </p>
          </div>
        ) : null}
      </section>

      <Dialog
        open={Boolean(removeCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveCandidate(null);
          }
        }}
      >
        <DialogContent className="border border-slate-200 bg-white text-zinc-950 shadow-2xl sm:max-w-md dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Remove this physical package?</DialogTitle>
            <DialogDescription>
              Its assigned quantities will become unpacked. They will not be
              moved into another package automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>Manual reallocation required</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                After removal, assign every affected unit yourself before the
                packing plan can be saved again.
              </AlertDescription>
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setRemoveCandidate(null)} type="button" variant="outline">
              Keep package
            </Button>
            <Button onClick={confirmRemovePackage} type="button" variant="destructive">
              <Trash2Icon aria-hidden="true" className="size-4" />
              Remove package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
