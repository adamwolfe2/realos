export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="h-3 w-28 bg-muted/60 rounded" />
          <div className="h-7 w-56 bg-muted rounded-md" />
          <div className="h-4 w-96 bg-muted/60 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-44 bg-muted rounded-md" />
          <div className="h-9 w-44 bg-muted/60 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="h-9 w-32 bg-muted rounded-md" />
          <div className="h-9 w-32 bg-muted/60 rounded-md" />
          <div className="h-9 w-24 bg-muted/40 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="h-3 w-16 bg-muted/60 rounded" />
                <div className="h-3 w-12 bg-muted/40 rounded" />
              </div>
              <div className="h-4 w-64 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted/50 rounded" />
            </div>
            <div className="h-4 w-10 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
