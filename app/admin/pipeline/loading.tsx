export default function PipelineLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-48 shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-4 w-5 bg-muted/40 rounded" />
              </div>
              {Array.from({ length: i < 3 ? 2 : 1 }).map((_, j) => (
                <div
                  key={j}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                >
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted/50 rounded" />
                  <div className="h-3 w-16 bg-muted/40 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
