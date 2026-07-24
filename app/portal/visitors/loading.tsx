import {
  Skeleton,
  SkeletonKpi,
  SkeletonRow,
} from "@/components/portal/ui/skeleton";

// Loading state for /portal/visitors. Matches the Window/Status/Sort
// filter bar, the 4 KPI tiles (Total visits / Identified / With email /
// Matched to a lead), and the DataTable footprint below them.
export default function VisitorsLoading() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-72 mt-1" />
      </div>
      <div className="rounded-xl border border-border bg-card px-3 py-2 flex gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-36" />
      </div>
      {/* Window / Status / Sort filter bar — same rounded-xl card + 3
          legend/pill-group footprint as the real page's TabGroup row. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-7 w-40 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpi key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-3 py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={i === 0 ? "h-2.5 w-24 flex-[2]" : "h-2.5 w-12 flex-1"}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} cols={8} />
        ))}
      </div>
    </div>
  );
}
