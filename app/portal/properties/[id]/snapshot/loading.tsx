export default function PropertySnapshotLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back bar */}
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 bg-muted/60 rounded" />
        <div className="h-8 w-20 bg-muted rounded-md" />
      </div>

      {/* Report header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1.5">
          <div className="h-6 w-72 bg-muted rounded-md" />
          <div className="h-3.5 w-64 bg-muted/60 rounded" />
        </div>
        <div className="h-7 w-24 bg-muted/60 rounded" />
      </div>

      {/* Tab row */}
      <div className="flex flex-nowrap gap-4 border-b border-border pb-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-20 bg-muted/60 rounded" />
        ))}
      </div>

      {/* Overview KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ls-card p-5 space-y-3">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/50 rounded" />
          </div>
        ))}
      </div>

      {/* Two-column section content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="ls-card p-5 space-y-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-24 w-full bg-muted/50 rounded" />
        </div>
        <div className="ls-card p-5 space-y-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-24 w-full bg-muted/50 rounded" />
        </div>
      </div>
    </div>
  );
}
