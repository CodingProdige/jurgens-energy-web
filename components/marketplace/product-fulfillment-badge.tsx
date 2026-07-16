import { TruckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductFulfillmentMode } from "@/src/modules/shipping";

export function MarketplaceProductFulfillmentBadge({
  fulfillmentMode,
  label,
}: {
  fulfillmentMode: ProductFulfillmentMode;
  label?: string;
}) {
  const isJurgensFulfilled = fulfillmentMode === "piessang_fulfilled";

  return (
    <Badge
      className={cn(
        "inline-flex h-[15px] max-w-full items-center gap-0.5 rounded-none px-1 text-[6.5px] font-black uppercase leading-none shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]",
        isJurgensFulfilled
          ? "bg-emerald-500 text-white"
          : "bg-[#1a1a1a] text-white dark:bg-[#f7f7f2] dark:text-[#080808]",
      )}
    >
      <TruckIcon className="size-2.5 shrink-0 sm:size-3" />
      <span className="truncate">
        {label ?? (isJurgensFulfilled ? "Local" : "Courier")}
      </span>
    </Badge>
  );
}
