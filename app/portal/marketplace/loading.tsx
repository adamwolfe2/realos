// Loading skeleton for /portal/marketplace. Mirrors the marketplace
// hero + 4 category sections with 3 cards each so the page fills in
// instead of flashing from blank.

export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-12 lg:px-10 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="space-y-4 max-w-2xl flex-1">
              <div className="h-3 w-40 bg-primary/10 rounded" />
              <div className="space-y-2">
                <div className="h-10 w-full max-w-lg bg-muted rounded" />
                <div className="h-10 w-3/4 max-w-md bg-muted rounded" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full max-w-xl bg-muted/60 rounded" />
                <div className="h-3 w-3/4 max-w-md bg-muted/60 rounded" />
              </div>
              <div className="flex gap-4 pt-3">
                <div className="h-11 w-44 bg-primary/20 rounded-md" />
                <div className="h-11 w-24 bg-muted rounded-md" />
              </div>
            </div>
            <div className="lg:min-w-[280px] rounded-xl border border-border bg-muted/30 p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
              <div className="h-1.5 bg-muted rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Card grid skeleton */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        {[0, 1, 2, 3].map((cat) => (
          <div key={cat} className="mb-14 last:mb-0">
            <div className="flex items-baseline justify-between mb-6">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map((card) => (
                <div
                  key={card}
                  className="rounded-xl border border-border bg-card p-6 space-y-4"
                >
                  <div className="w-9 h-9 rounded-md bg-primary/10" />
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted/60 rounded" />
                    <div className="h-3 w-2/3 bg-muted/60 rounded" />
                  </div>
                  <div className="space-y-2 pt-2">
                    {[0, 1, 2, 3].map((b) => (
                      <div
                        key={b}
                        className="h-3 w-full bg-muted/40 rounded"
                      />
                    ))}
                  </div>
                  <div className="border-t border-border pt-5 space-y-3">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-10 bg-primary/10 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
