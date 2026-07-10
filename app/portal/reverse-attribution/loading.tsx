export default function ReverseAttributionLoading() {
  return (
    <div
      className="space-y-3 animate-pulse"
      aria-label="Loading reverse attribution"
    >
      <div>
        <div className="h-7 w-56 rounded-[2px] bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full rounded-[2px] bg-muted/60" />
      </div>
      <div className="h-12 rounded-[2px] border border-border bg-card" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[2px] border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-24 rounded-[2px] bg-muted/60" />
            <div className="h-7 w-16 rounded-[2px] bg-muted" />
            <div className="h-3 w-20 rounded-[2px] bg-muted/40" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-[2px] border border-border bg-card p-4">
          <div className="h-4 w-44 rounded-[2px] bg-muted" />
          <div className="mt-2 h-3 w-72 max-w-full rounded-[2px] bg-muted/60" />
          <div className="mt-4 h-48 rounded-[2px] bg-muted/30" />
        </div>
      ))}
    </div>
  );
}
