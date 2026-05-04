import { Skeleton, SkeletonRow } from "@/components/portal/ui/skeleton";

// Loading state for /portal/properties — matches the DataTable footprint
// of the loaded page (header + table) so layout doesn't shift on hydrate.
export default function PropertiesLoading() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-80 mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header echo */}
        <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-3 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className={i === 0 ? "h-2.5 w-24 flex-[2]" : "h-2.5 w-12 flex-1"}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} cols={6} />
        ))}
      </div>
    </div>
  );
}
