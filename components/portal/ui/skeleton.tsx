import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Skeleton — single placeholder used during data fetches so widgets render
// at their final dimensions instead of jumping when data arrives. Pulses
// subtly using a muted background. Token-driven so it picks up the cream
// canvas automatically.
//
// Usage:
//   <Skeleton className="h-4 w-32" />
//   <Skeleton className="h-32 w-full" />
//   <SkeletonText lines={3} />
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-muted/60 animate-pulse",
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3",
            i === lines - 1 && lines > 1 ? "w-4/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

// KPI tile skeleton with the same dimensions as a real KpiTile so the grid
// doesn't jump when data lands.
export function SkeletonKpi() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-2 w-24" />
    </div>
  );
}

// Table-row skeleton matched to the DataTable density.
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div
      className="flex items-center gap-3 border-b border-border last:border-0 px-3 py-2"
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3",
            i === 0 ? "flex-[2]" : "flex-1",
          )}
        />
      ))}
    </div>
  );
}
