export default function BriefingLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-32 bg-muted rounded-md" />
        <div className="h-4 w-64 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted/50 rounded" />
                </div>
                <div className="h-5 w-16 bg-muted/60 rounded-full" />
              </div>
              <div className="h-3 w-full bg-muted/40 rounded" />
              <div className="h-3 w-3/4 bg-muted/30 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-6 w-16 bg-muted rounded-md" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-full bg-muted/50 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
