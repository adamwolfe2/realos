// Loading skeleton for /portal/marketplace. Mirrors the PageHeader +
// category / card-grid layout so the page fills in instead of flashing blank.

export default function MarketplaceLoading() {
  return (
    <div className="animate-pulse">
      {/* PageHeader skeleton */}
      <div className="pb-5 mb-6 border-b border-border flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-8 w-36 bg-muted rounded" />
          <div className="h-3.5 w-full max-w-xl bg-muted/60 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 bg-muted/50 rounded-md" />
          <div className="h-9 w-40 bg-primary/20 rounded-md" />
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-6">
        {[0, 1, 2, 3].map((cat) => (
          <div key={cat}>
            {/* SectionLabel skeleton */}
            <div className="flex items-baseline justify-between mb-3">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-14 bg-muted/50 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {[0, 1, 2].map((card) => (
                <div
                  key={card}
                  className="ls-card relative p-4 space-y-3"
                  style={{ minHeight: 144 }}
                >
                  {/* Top stripe */}
                  <span className="absolute top-0 left-0 right-0 h-[2px] bg-primary/10 rounded-t" />
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3.5 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-full bg-muted/60 rounded" />
                      <div className="h-3 w-2/3 bg-muted/60 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="h-3 w-20 bg-secondary rounded" />
                    <div className="h-7 w-16 bg-primary/10 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
