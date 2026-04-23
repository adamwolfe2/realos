export default function ClientDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-8 w-56 bg-muted rounded" />
        <div className="h-4 w-36 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="h-5 w-36 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-4 w-40 bg-muted/80 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
