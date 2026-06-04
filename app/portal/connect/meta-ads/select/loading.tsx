// Skeleton for /portal/connect/meta-ads/select — picker that lists
// the operator's available Meta Ad Accounts after OAuth. Mirror of
// the Google Ads selector loader.

export default function MetaAdsSelectLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-56 bg-muted rounded-md" />
        <div className="h-4 w-[24rem] max-w-full bg-muted/60 rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-md bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted/50 rounded" />
            </div>
            <div className="h-8 w-20 bg-muted/60 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
