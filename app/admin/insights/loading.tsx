// Loading skeleton for /admin/insights — mirrors the cross-portfolio
// triage table.

export default function AdminInsightsLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-48 bg-muted rounded" />
        <div className="h-7 w-72 bg-muted rounded" />
        <div className="h-3 w-96 bg-muted/60 rounded" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-24 bg-muted rounded-full" />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="h-3 w-40 bg-muted rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-md border border-border bg-muted/20"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3"
          >
            <div className="w-20 h-5 bg-muted rounded-full shrink-0" />
            <div className="w-40 space-y-1 shrink-0">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-2 w-16 bg-muted/60 rounded" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-2 w-full bg-muted/60 rounded" />
            </div>
            <div className="w-32 h-3 bg-muted/60 rounded shrink-0" />
            <div className="w-24 h-3 bg-muted/60 rounded shrink-0" />
            <div className="w-16 h-3 bg-muted rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
