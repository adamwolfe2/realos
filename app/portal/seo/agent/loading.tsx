export default function SeoAgentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-48 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted/50 rounded" />
            </div>
            <div className="p-5">
              <div className="h-48 w-full bg-muted/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
