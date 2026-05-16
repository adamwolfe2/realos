export default function NotificationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-7 w-36 bg-muted rounded-md" />
          <div className="h-4 w-24 bg-muted/60 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-md" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-muted/60 mt-2 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-64 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted/60 rounded" />
            </div>
            <div className="h-3 w-16 bg-muted/40 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
