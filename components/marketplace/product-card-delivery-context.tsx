"use client";

import { TruckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMarketplaceDeliveryWindow } from "@/components/marketplace/marketplace-delivery-window-provider";

function formatEstimateDate(value: string) {
  const datePart = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(`${datePart}T12:00:00+02:00`));
}

function getAddressEstimateLabel(
  estimate: ReturnType<typeof useMarketplaceDeliveryWindow>,
) {
  if (!estimate?.available) {
    return null;
  }

  const from = estimate.estimatedDeliveryFrom;
  const to = estimate.estimatedDeliveryTo;

  if (!from && !to) {
    return null;
  }

  if (!from || from === to) {
    return `Expected by ${formatEstimateDate(to ?? from!)}`;
  }

  if (!to) {
    return `Expected from ${formatEstimateDate(from)}`;
  }

  return `Expected ${formatEstimateDate(from)}–${formatEstimateDate(to)}`;
}

export function ProductCardDeliveryContext({
  className,
  compactOnMobile = false,
  estimateLabel = "Delivery estimate available",
}: {
  className?: string;
  compactOnMobile?: boolean;
  estimateLabel?: string;
}) {
  const deliveryWindow = useMarketplaceDeliveryWindow();
  const addressEstimateLabel = getAddressEstimateLabel(deliveryWindow);
  const resolvedLabel = addressEstimateLabel ?? estimateLabel;
  const compactLabel = addressEstimateLabel
    ? addressEstimateLabel
    : `Delivery: ${estimateLabel.replace(/\bbusiness\s+/i, "")}`;

  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1 text-[8px] font-semibold leading-3 text-emerald-700 dark:text-emerald-300 sm:text-[9px]",
        className,
      )}
    >
      <TruckIcon aria-hidden="true" className="size-2.5 shrink-0 sm:size-3" />
      {compactOnMobile ? (
        <>
          <span className="truncate sm:hidden">{compactLabel}</span>
          <span className="hidden truncate sm:inline">
            {addressEstimateLabel
              ? addressEstimateLabel
              : `Estimated delivery: ${resolvedLabel}`}
          </span>
        </>
      ) : (
        <span className="truncate">
          {addressEstimateLabel
            ? addressEstimateLabel
            : `Estimated delivery: ${resolvedLabel}`}
        </span>
      )}
    </p>
  );
}
