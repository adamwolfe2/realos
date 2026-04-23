export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-64 bg-muted/60 rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1">
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted/50 rounded" />
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="h-3 w-24 bg-muted/60 rounded" />
                <div className="h-9 w-full bg-muted/50 rounded-md" />
              </div>
            ))}
          </div>
          <div className="h-8 w-24 bg-muted/60 rounded-md" />
        </div>
      ))}
    </div>
  );
}
