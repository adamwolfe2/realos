export default function CreativeDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-3 w-28 bg-muted/60 rounded" />
      <div className="h-3 w-48 bg-muted/40 rounded" />
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="h-6 w-64 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted/60 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-full bg-muted/40 rounded" />
          ))}
        </div>
        <div className="h-24 w-full bg-muted/30 rounded" />
      </div>
    </div>
  );
}
