"use client";

import { Children, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type StorefrontLoadMoreGridProps = {
  children: ReactNode;
  className?: string;
  increment?: number;
  initialCount?: number;
};

export function StorefrontLoadMoreGrid({
  children,
  className,
  increment = 8,
  initialCount = 8,
}: StorefrontLoadMoreGridProps) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(initialCount, items.length),
  );
  const visibleItems = items.slice(0, visibleCount);
  const remainingCount = Math.max(items.length - visibleCount, 0);

  return (
    <div className={cn("mt-2.5 px-1.5 sm:mt-5 sm:px-0", className)}>
      <div className="grid grid-cols-2 items-stretch gap-1.5 sm:gap-4 md:grid-cols-4">
        {visibleItems}
      </div>
      {remainingCount > 0 ? (
        <div className="mt-5 flex justify-center sm:mt-7">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#080808] px-7 text-[14px] font-black uppercase tracking-[0.04em] text-white shadow-[0_12px_28px_rgba(8,8,8,0.16)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:bg-[#f7f7f2] dark:text-[#080808]"
            onClick={() =>
              setVisibleCount((currentCount) =>
                Math.min(currentCount + increment, items.length),
              )
            }
            type="button"
          >
            Load more
            <span className="ml-2 rounded-full bg-white/14 px-2 py-0.5 text-[11px] text-white/82 dark:bg-[#080808]/10 dark:text-[#080808]/70">
              {remainingCount}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
