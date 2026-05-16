export default function PortalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-48 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-12 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-muted/50 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
