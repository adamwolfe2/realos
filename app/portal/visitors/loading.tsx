export default function VisitorsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-28 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded-md" />
            <div className="h-3 w-14 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        <div className="px-5 py-3 flex gap-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted/60 rounded" />
          <div className="h-4 w-24 bg-muted/60 rounded" />
          <div className="h-4 w-20 bg-muted/40 rounded" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-4">
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted/50 rounded" />
            <div className="h-4 w-16 bg-muted/50 rounded" />
            <div className="h-4 w-12 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
