// Loading skeleton for /portal/seo/agent. Mirrors the actual page
// structure (header, property switcher, connect card, integration row,
// exec summary, range selector, health score, action bar, recommendations,
// charts grid, score history) so perceived load is instant — the shell
// appears immediately while server data resolves.

export default function SeoAgentLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="space-y-1.5">
        <div className="h-2.5 w-32 bg-muted/60 rounded" />
        <div className="h-7 w-72 bg-muted rounded" />
        <div className="h-3.5 w-[480px] max-w-full bg-muted/40 rounded" />
      </div>

      {/* Property switcher (only renders for multi-property orgs but
          reserving the space avoids layout jank when it shows up). */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-card p-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-32 bg-muted/60 rounded-lg" />
        ))}
      </div>

      {/* Connect website card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="h-4 w-44 bg-muted rounded" />
        <div className="h-3 w-80 bg-muted/40 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>

      {/* Integration status strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-border bg-card" />
        ))}
      </div>

      {/* Executive summary KPI strip */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border/60 flex justify-between">
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted/50 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="h-2.5 w-20 bg-muted/60 rounded" />
              <div className="h-5 w-16 bg-muted rounded" />
              <div className="h-2.5 w-12 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-14 rounded-md bg-muted/60" />
        ))}
      </div>

      {/* Health score card */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30" />
          ))}
        </div>
      </div>

      {/* Action bar (refresh + draft) */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex justify-between items-center">
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 bg-muted rounded" />
          <div className="h-3 w-72 bg-muted/40 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-40 bg-muted rounded-lg" />
          <div className="h-8 w-28 bg-primary/40 rounded-lg" />
        </div>
      </div>

      {/* Recommendations panel */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border border-border rounded-lg p-3"
          >
            <div className="h-5 w-16 bg-muted/60 rounded-md shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Cross-source charts (2-column grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-border/60">
              <div className="h-2.5 w-20 bg-muted/60 rounded mb-1" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
            <div className="p-5">
              <div className="h-48 w-full rounded bg-muted/30" />
            </div>
          </div>
        ))}
      </div>

      {/* Score history line chart */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-56 w-full bg-muted/30 rounded" />
      </div>
    </div>
  );
}
