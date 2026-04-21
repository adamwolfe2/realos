export default function ConversationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-52 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded mt-2" />
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full bg-muted rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-28 bg-muted/60 rounded-md" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-64 bg-muted/50 rounded" />
            </div>
            <div className="text-right space-y-1">
              <div className="h-4 w-8 bg-muted rounded ml-auto" />
              <div className="h-3 w-20 bg-muted/50 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
