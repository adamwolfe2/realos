export default function PortalLoading() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="pb-5 mb-6 border-b border-border">
        <div className="h-7 w-48 bg-muted rounded-md" />
        <div className="h-4 w-64 bg-muted/60 rounded mt-2" />
      </div>

      {/* KPI strip — 4 tiles, mirrors the KpiTile grid. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[2px] border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main grid — chart + pipeline (left) / attention queue + lead
          source + activity (right). */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2 items-start">
        <div className="space-y-2 min-w-0">
          <div className="rounded-[2px] border border-border bg-card p-5 h-[300px]">
            <div className="h-4 w-40 bg-muted rounded" />
          </div>
          <div className="rounded-[2px] border border-border bg-card p-4 h-16">
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <div className="rounded-[2px] border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-40 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-3 w-full bg-muted/50 rounded" />
            ))}
          </div>
          <div className="rounded-[2px] border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-3 w-full bg-muted/50 rounded" />
            ))}
          </div>
          <div className="rounded-[2px] border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 w-full bg-muted/50 rounded" />
            ))}
          </div>
        </div>
      </div>

      <div className="h-9 rounded-[2px] border border-border bg-card" />
      <div className="h-9 rounded-[2px] border border-border bg-card" />
    </div>
  );
}
