// Skeleton for /portal/properties/[id]/edit — property edit form.
// Section cards stack: identity, address, leasing details, photos,
// amenities. The form is heavy server-side (loads listing data +
// AppFolio mirrors); a skeleton makes the route feel instant.

export default function PropertyEditLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-56 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5 space-y-4"
        >
          <div className="space-y-1">
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted/50 rounded" />
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="h-3 w-24 bg-muted/60 rounded" />
                <div className="h-9 w-full bg-muted/50 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
