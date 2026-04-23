export default function IntegrationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-32 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-muted rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-muted/40 rounded" />
            <div className="h-3 w-3/4 bg-muted/30 rounded" />
            <div className="h-8 w-24 bg-muted/50 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
