export default function CreativeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-36 bg-muted rounded-md" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-32 bg-muted rounded-md" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 bg-muted/60 rounded-full" />
                  <div className="h-3 w-16 bg-muted/40 rounded" />
                </div>
                <div className="h-4 w-56 bg-muted rounded" />
                <div className="h-3 w-full bg-muted/40 rounded" />
                <div className="h-3 w-4/5 bg-muted/30 rounded" />
              </div>
              <div className="h-8 w-8 bg-muted/50 rounded-md" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-7 w-20 bg-muted/50 rounded-md" />
              <div className="h-7 w-24 bg-muted/40 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
