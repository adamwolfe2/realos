export default function InsightsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-28 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-28 bg-muted rounded-md" />
        <div className="h-9 w-24 bg-muted/70 rounded-md" />
        <div className="h-9 w-28 bg-muted/50 rounded-md" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-muted/60 rounded-full" />
                <div className="h-3 w-20 bg-muted/40 rounded" />
              </div>
              <div className="h-3 w-12 bg-muted/40 rounded" />
            </div>
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="h-3 w-full bg-muted/40 rounded" />
            <div className="h-3 w-5/6 bg-muted/30 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
