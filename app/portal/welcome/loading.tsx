// Skeleton for /portal/welcome — first-run landing. Big hero with
// title + sub + 4 quick-start cards. Cheap to render and avoids the
// brand-new tenant landing on a blank page while server-component
// queries warm up.

export default function WelcomeLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-9 w-72 bg-muted rounded-md" />
        <div className="h-4 w-[28rem] max-w-full bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="h-9 w-9 rounded-md bg-muted" />
            <div className="h-4 w-44 bg-muted rounded" />
            <div className="h-3 w-full bg-muted/50 rounded" />
            <div className="h-3 w-2/3 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
