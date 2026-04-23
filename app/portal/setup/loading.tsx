export default function SetupLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted rounded-md" />
          <div className="h-4 w-96 bg-muted/60 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-1.5 w-1/3 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-28 bg-muted rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-4 w-24 bg-muted/60 rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 flex gap-5"
          >
            <div className="h-5 w-5 rounded-full bg-muted shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-3 w-72 bg-muted/60 rounded" />
              <div className="h-3 w-56 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
