import { TruckIcon } from "lucide-react";

export function ProductCardDeliveryContext({
  estimateLabel = "Delivery estimate available",
}: {
  estimateLabel?: string;
}) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-[8px] font-semibold leading-3 text-emerald-700 dark:text-emerald-300 sm:text-[9px]">
      <TruckIcon aria-hidden="true" className="size-2.5 shrink-0 sm:size-3" />
      <span className="truncate">
        Estimated delivery: {estimateLabel}
      </span>
    </p>
  );
}
