export default function LeadsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="h-3 w-20 bg-muted rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-12 w-full bg-muted/50 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
