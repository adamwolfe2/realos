import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PageSkeleton — parameterized loading skeleton used by every route that
// would otherwise flash a blank container during streaming. Variants map to
// the four canonical portal page archetypes:
//
//   list      → header + filter row + table rows
//   detail    → page header + two-column body + sidebar
//   dashboard → header + KPI strip + two content cards
//   form      → header + stacked input rows + footer button bar
//
// Shimmer uses a brand-tinted base (--accent-wash, the 10% blue wash from
// globals.css) instead of the cool `bg-gray-200`. Pulse + brand tint keeps
// the loading state on-brand and lets the parchment/white canvas read as a
// single continuous surface during navigation.
// ---------------------------------------------------------------------------

export type PageSkeletonVariant = "list" | "detail" | "dashboard" | "form";

type Props = {
  variant?: PageSkeletonVariant;
  /** Header row count — 1 (default) is title + subtitle. */
  headerRows?: 1 | 2;
  className?: string;
};

// Brand-tinted shimmer — `--accent-wash` is rgba(37,99,235,0.10). The /60
// and /40 variants step the tint down so deeper / smaller skeleton bones
// don't all flash with the same intensity (mirrors the cadence the eye
// expects from real content hierarchy).
const SHIMMER_BASE =
  "bg-[color:var(--accent-wash)] animate-pulse rounded-md";
const SHIMMER_MUTED =
  "bg-[color:var(--accent-wash)]/60 animate-pulse rounded-md";
const SHIMMER_FAINT =
  "bg-[color:var(--accent-wash)]/40 animate-pulse rounded";

export function PageSkeleton({
  variant = "list",
  headerRows = 1,
  className,
}: Props) {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={cn("space-y-6", className)}
    >
      <Header rows={headerRows} />
      {variant === "list" && <ListBody />}
      {variant === "detail" && <DetailBody />}
      {variant === "dashboard" && <DashboardBody />}
      {variant === "form" && <FormBody />}
    </div>
  );
}

function Header({ rows }: { rows: 1 | 2 }) {
  return (
    <div className="space-y-2">
      <div className={cn(SHIMMER_BASE, "h-7 w-56")} />
      {rows === 2 ? (
        <div className={cn(SHIMMER_MUTED, "h-4 w-80")} />
      ) : null}
    </div>
  );
}

function ListBody() {
  return (
    <div className="space-y-4">
      {/* Filter / toolbar row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(SHIMMER_MUTED, "h-8 w-48")} />
        <div className={cn(SHIMMER_MUTED, "h-8 w-24")} />
        <div className={cn(SHIMMER_MUTED, "h-8 w-24")} />
        <div className={cn(SHIMMER_MUTED, "h-8 w-32 ml-auto")} />
      </div>
      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-10 border-b border-border bg-secondary" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
          >
            <div className={cn(SHIMMER_FAINT, "h-4 w-4 shrink-0")} />
            <div className={cn(SHIMMER_BASE, "h-4 w-1/4")} />
            <div className={cn(SHIMMER_FAINT, "h-4 w-1/6")} />
            <div className={cn(SHIMMER_FAINT, "h-4 w-1/6")} />
            <div className={cn(SHIMMER_FAINT, "h-4 w-1/6 ml-auto")} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBody() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className={cn(SHIMMER_BASE, "h-5 w-40")} />
          <div className={cn(SHIMMER_FAINT, "h-4 w-full")} />
          <div className={cn(SHIMMER_FAINT, "h-4 w-11/12")} />
          <div className={cn(SHIMMER_FAINT, "h-4 w-4/5")} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className={cn(SHIMMER_BASE, "h-5 w-32")} />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className={cn(SHIMMER_FAINT, "h-3 w-20")} />
                <div className={cn(SHIMMER_MUTED, "h-5 w-28")} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className={cn(SHIMMER_BASE, "h-5 w-28")} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn(SHIMMER_FAINT, "h-4 w-full")} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardBody() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className={cn(SHIMMER_FAINT, "h-3 w-20")} />
            <div className={cn(SHIMMER_BASE, "h-7 w-14")} />
            <div className={cn(SHIMMER_FAINT, "h-2 w-full mt-2")} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <div className={cn(SHIMMER_BASE, "h-5 w-40")} />
          <div className={cn(SHIMMER_FAINT, "h-48 w-full")} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className={cn(SHIMMER_BASE, "h-5 w-32")} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className={cn(SHIMMER_FAINT, "h-4 w-24")} />
              <div className={cn(SHIMMER_FAINT, "h-4 w-12")} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormBody() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className={cn(SHIMMER_FAINT, "h-3 w-24")} />
            <div className={cn(SHIMMER_MUTED, "h-10 w-full")} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className={cn(SHIMMER_FAINT, "h-9 w-20")} />
        <div className={cn(SHIMMER_BASE, "h-9 w-28")} />
      </div>
    </div>
  );
}
