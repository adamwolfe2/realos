export default function LeadDetailLoading() {
  return (
    <div className="animate-pulse" aria-label="Loading lead">
      {/* Back link */}
      <div className="h-4 w-24 bg-muted/60 rounded mb-3" />
      <p className="text-xs text-muted-foreground mb-4 not-sr-only">
        Loading lead…
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-4 w-36 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-muted/40 rounded" />
              ))}
            </div>
          </div>

          {/* Timeline card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="h-5 w-24 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 w-4 rounded-full bg-muted/60 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-56 bg-muted rounded" />
                  <div className="h-3 w-36 bg-muted/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="h-4 w-24 bg-muted rounded" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-muted/50 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
