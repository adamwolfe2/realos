export default function AttributionLoading() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Loading attribution">
      <div>
        <div className="h-7 w-48 bg-muted rounded" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>
      <div className="h-16 rounded-xl border border-border bg-card" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted/60 rounded mt-2" />
          <div className="h-48 bg-muted/30 rounded mt-4" />
        </div>
      ))}
    </div>
  );
}
