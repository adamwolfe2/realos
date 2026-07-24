export default function ChatbotInsightsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-52 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-1.5">
        <div className="h-6 w-16 bg-muted rounded-full" />
        <div className="h-6 w-16 bg-muted/70 rounded-full" />
        <div className="h-6 w-16 bg-muted/50 rounded-full" />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted/60 rounded" />
            <div className="h-3 w-24 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Top questions / top keywords */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-3 w-5 shrink-0 bg-muted/50 rounded" />
                  <div className="h-3 flex-1 bg-muted/50 rounded" />
                  <div className="h-3 w-6 shrink-0 bg-muted/40 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
