export default function ConversationDetailLoading() {
  return (
    <div className="flex gap-5 h-[calc(100vh-4rem)] animate-pulse">
      {/* Transcript */}
      <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        <div className="border-b border-border p-4 space-y-1">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted/60 rounded" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}
            >
              <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
              <div
                className={`rounded-xl p-3 space-y-1.5 max-w-xs ${
                  i % 2 === 0 ? "bg-muted" : "bg-muted/40"
                }`}
              >
                <div className="h-3 w-40 bg-muted/60 rounded" />
                <div className="h-3 w-28 bg-muted/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Sidebar */}
      <div className="w-72 shrink-0 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 w-full bg-muted/50 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
