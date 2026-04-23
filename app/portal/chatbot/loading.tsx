export default function ChatbotLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-32 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="h-4 w-28 bg-muted rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-muted/60 rounded" />
              <div className="h-9 w-full bg-muted/50 rounded-md" />
            </div>
          ))}
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-muted/60 rounded" />
            <div className="h-20 w-full bg-muted/50 rounded-md" />
          </div>
          <div className="h-9 w-28 bg-muted rounded-md" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="rounded-lg border border-border bg-muted/20 h-72 flex flex-col justify-end p-3 space-y-2">
            <div className="h-8 w-3/4 bg-muted/50 rounded-xl self-start" />
            <div className="h-8 w-1/2 bg-muted/40 rounded-xl self-end" />
            <div className="h-8 w-2/3 bg-muted/50 rounded-xl self-start" />
          </div>
          <div className="h-9 w-full bg-muted/40 rounded-md" />
        </div>
      </div>
    </div>
  );
}
