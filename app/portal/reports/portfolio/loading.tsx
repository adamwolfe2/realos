export default function PortfolioFunnelLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* PageHeader */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="h-7 w-56 bg-muted rounded-md" />
          <div className="h-4 w-96 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-64 bg-muted rounded-md" />
      </div>

      {/* Period pills */}
      <div className="flex items-center gap-1.5">
        <div className="h-7 w-24 bg-muted rounded-[2px]" />
        <div className="h-7 w-24 bg-muted/60 rounded-[2px]" />
        <div className="h-7 w-24 bg-muted/60 rounded-[2px]" />
      </div>

      {/* Funnel strip — 4 KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ls-card p-5 space-y-3">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/50 rounded" />
          </div>
        ))}
      </div>

      {/* Sources + by-property table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="ls-card p-5 space-y-3">
          <div className="h-4 w-32 bg-muted rounded mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-24 bg-muted/60 rounded" />
              <div className="h-2 flex-1 bg-muted rounded-[2px]" />
              <div className="h-3 w-6 bg-muted/60 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="flex gap-4">
                  <div className="h-3 w-8 bg-muted/60 rounded" />
                  <div className="h-3 w-8 bg-muted/60 rounded" />
                  <div className="h-3 w-8 bg-muted/60 rounded" />
                  <div className="h-3 w-8 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
