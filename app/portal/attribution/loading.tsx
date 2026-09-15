export default function AttributionLoading() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading attribution">
      <div>
        <div className="h-7 w-48 rounded-[2px] bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full rounded-[2px] bg-muted/60" />
      </div>
      <div className="h-10 rounded-[2px] border border-border bg-card" />
      <div className="h-14 rounded-[2px] border border-border bg-card" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="ls-card p-4 space-y-2"
          >
            <div className="h-3 w-20 rounded-[2px] bg-muted/60" />
            <div className="h-7 w-16 rounded-[2px] bg-muted" />
            <div className="h-3 w-24 rounded-[2px] bg-secondary" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ls-card p-4">
          <div className="h-4 w-40 rounded-[2px] bg-muted" />
          <div className="mt-2 h-3 w-64 max-w-full rounded-[2px] bg-muted/60" />
          <div className="mt-4 h-48 rounded-[2px] bg-muted/30" />
        </div>
      ))}
    </div>
  );
}
