// Loading skeleton for /portal/connect. Mirrors the ConnectHub layout
// so the page feels like it's "filling in" rather than appearing
// from blank. Uses brand-blue subtle pulse on neutral cards.

export default function ConnectLoading() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-8 lg:py-12 space-y-8 animate-pulse">
      {/* Hero skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-32 bg-primary/10 rounded" />
        <div className="h-8 w-3/4 max-w-md bg-muted rounded" />
        <div className="h-4 w-full max-w-xl bg-muted/60 rounded" />
        <div className="h-4 w-2/3 max-w-md bg-muted/60 rounded" />
      </div>

      {/* Progress bar skeleton */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden" />
      </div>

      {/* Card grid skeleton — 4 categories with 2 cards each */}
      {[0, 1, 2, 3].map((cat) => (
        <div key={cat} className="space-y-3">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[0, 1].map((card) => (
              <div
                key={card}
                className="rounded-lg border border-border bg-card p-5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-primary/10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 bg-muted rounded" />
                    <div className="h-3 w-3/4 bg-muted/60 rounded" />
                  </div>
                </div>
                <div className="border-t border-border-soft/40 pt-3 space-y-2">
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted/60 rounded" />
                  <div className="h-3 w-1/2 bg-muted/60 rounded" />
                  <div className="h-10 rounded-md bg-primary/10 mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
