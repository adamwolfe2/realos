export default function PropertyDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="h-8 w-56 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-md" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-border pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted/60 rounded-t" />
        ))}
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="h-4 w-32 bg-muted rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-4 w-48 bg-muted/80 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
