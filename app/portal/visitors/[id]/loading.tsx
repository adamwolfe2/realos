export default function VisitorDetailLoading() {
  return (
    <div className="animate-pulse">
      {/* Back link */}
      <div className="h-4 w-28 bg-muted/60 rounded mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-40 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted/60 rounded" />
              </div>
              <div className="h-7 w-20 bg-muted rounded-full" />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-7 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>

          {/* Session list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-36 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted/50 rounded" />
                </div>
                <div className="flex gap-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-3 w-16 bg-muted/40 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="h-4 w-28 bg-muted rounded" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-muted/50 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
