// Skeleton for /portal/integrations — mirrors the integrations grid
// layout (title + sub + 6 integration cards in a 3-up grid). Replaces
// the blank-flash that operators saw when navigating from the
// dashboard "Connect AppFolio" CTA or the sidebar.

export default function IntegrationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-40 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[2px] border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-muted" />
              <div className="h-4 w-28 bg-muted rounded" />
            </div>
            <div className="h-3 w-full bg-muted/50 rounded" />
            <div className="h-3 w-3/4 bg-secondary rounded" />
            <div className="h-8 w-24 bg-muted/60 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
