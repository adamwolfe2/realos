export default function CreativeRequestDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      <div className="h-4 w-24 bg-muted/60 rounded" />
      <div className="space-y-2">
        <div className="h-7 w-72 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-5 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-4 w-full bg-muted/40 rounded" />
        <div className="h-4 w-3/4 bg-muted/40 rounded" />
        <div className="h-4 w-5/6 bg-muted/40 rounded" />
      </div>
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="h-5 w-24 bg-muted rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-2">
            <div className="h-4 w-4 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
