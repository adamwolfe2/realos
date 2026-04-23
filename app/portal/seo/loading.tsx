export default function SeoLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-20 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="h-10 w-10 bg-muted rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted/50 rounded" />
        </div>
        <div className="h-8 w-28 bg-muted/60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted/50 rounded" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="h-3 w-40 bg-muted rounded" />
                  <div className="h-3 w-12 bg-muted/50 rounded" />
                  <div className="h-3 w-10 bg-muted/40 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
