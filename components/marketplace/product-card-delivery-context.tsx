import { TruckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProductCardDeliveryContext({
  className,
  estimateLabel = "Delivery estimate available",
}: {
  className?: string;
  estimateLabel?: string;
}) {
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1 text-[8px] font-semibold leading-3 text-emerald-700 dark:text-emerald-300 sm:text-[9px]",
        className,
      )}
    >
      <TruckIcon aria-hidden="true" className="size-2.5 shrink-0 sm:size-3" />
      <span className="truncate">
        Estimated delivery: {estimateLabel}
      </span>
    </p>
  );
}
