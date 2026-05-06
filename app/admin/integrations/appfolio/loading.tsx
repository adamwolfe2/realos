export default function AdminAppfolioLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-48 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted/40 rounded" />
            </div>
            <div className="h-7 w-20 bg-muted/60 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
