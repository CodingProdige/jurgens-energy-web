import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-white/[0.08]",
        className,
      )}
    />
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#151719]",
        className,
      )}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-56 max-w-full" />
      <Skeleton className="mt-6 h-52 w-full" />
    </div>
  );
}

export default function AdminAnalyticsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading analytics" className="grid gap-4">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-24" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#151719]">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-8 w-20" key={index} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#151719]"
            key={index}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-28" />
            <Skeleton className="mt-5 h-10 w-full" />
          </div>
        ))}
      </div>

      <PanelSkeleton className="min-h-[360px]" />
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}
