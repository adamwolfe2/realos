export default function BillingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-64 bg-muted/60 rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-5 w-20 bg-muted/60 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-muted/50 rounded" />
              <div className="h-6 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 bg-muted/60 rounded-md" />
          <div className="h-8 w-32 bg-muted/40 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-7 w-24 bg-muted rounded-md" />
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-3 w-full bg-muted/40 rounded" />
                ))}
              </div>
              <div className="h-8 w-full bg-muted/60 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
