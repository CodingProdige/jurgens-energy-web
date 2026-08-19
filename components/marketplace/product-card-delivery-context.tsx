import { TruckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProductCardDeliveryContext({
  className,
  compactOnMobile = false,
  estimateLabel = "Delivery estimate available",
}: {
  className?: string;
  compactOnMobile?: boolean;
  estimateLabel?: string;
}) {
  const compactLabel = `Delivery: ${estimateLabel.replace(/\bbusiness\s+/i, "")}`;

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
            Estimated delivery: {estimateLabel}
          </span>
        </>
      ) : (
        <span className="truncate">Estimated delivery: {estimateLabel}</span>
      )}
    </p>
  );
}
