export default function ReferralsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-28 bg-muted rounded-md" />
          <div className="h-4 w-72 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-32 bg-muted rounded-md" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-lg" />
              <div className="space-y-1 flex-1">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted/50 rounded" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 flex items-center gap-3">
              <div className="h-4 flex-1 bg-muted/60 rounded" />
              <div className="h-7 w-16 bg-muted rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <div className="h-3 w-16 bg-muted/50 rounded" />
                  <div className="h-5 w-10 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
