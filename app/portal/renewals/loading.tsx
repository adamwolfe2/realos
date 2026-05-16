export default function RenewalsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-12 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="h-3 w-16 bg-muted rounded" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-14 bg-muted/50 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
