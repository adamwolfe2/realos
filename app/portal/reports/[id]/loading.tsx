export default function ReportDetailLoading() {
  return (
    <div className="space-y-8 max-w-3xl animate-pulse">
      <div className="h-4 w-24 bg-muted/60 rounded" />
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-14 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-24 w-full bg-muted/40 rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="h-5 w-40 bg-muted rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 w-full bg-muted/40 rounded" />
        ))}
      </div>
    </div>
  );
}
