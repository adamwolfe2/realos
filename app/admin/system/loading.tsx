export default function SystemLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-20 bg-muted rounded-md" />
        <div className="h-4 w-56 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted/60 rounded" />
            </div>
            <div className="h-3 w-40 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
