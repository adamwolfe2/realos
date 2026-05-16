export default function ToursLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-7 w-16 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-12 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-10 bg-muted/40 border-b border-border" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted/60 rounded" />
            <div className="h-4 w-24 bg-muted/60 rounded" />
            <div className="h-4 w-16 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
