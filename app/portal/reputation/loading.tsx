// Mirrors the real page's current shape (app/portal/reputation/page.tsx):
// header, filter rail, 4-tile KPI strip (grid-cols-2 md:grid-cols-4), and
// the Recent mentions list. The analytics drawer is collapsed by default
// on the real page (a <details>, not rendered open), so no chart
// skeletons here — showing them would promise content that isn't visible
// until the operator opts in.
export default function ReputationLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-3 w-24 bg-muted/60 rounded" />
        <div className="h-8 w-40 bg-muted rounded-md mt-2" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>

      {/* Filter rail placeholder — matches the Suspense fallback used
        around ReputationFilters on the real page. */}
      <div className="h-8 w-full rounded-md bg-secondary" />

      {/* KPI strip — 4 tiles, same grid as the real page's KpiTile row. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ls-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-14 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/60 rounded" />
          </div>
        ))}
      </div>

      {/* Recent mentions — the real page's centerpiece list. */}
      <div className="ls-card">
        <div className="px-5 pt-4 pb-3.5 space-y-1.5">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="px-5 pb-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="shrink-0 h-9 w-9 rounded-lg bg-muted" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-48 bg-muted rounded" />
                <div className="h-3 w-full max-w-md bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
