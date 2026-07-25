export default function ApplicationsLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pb-5 mb-1 border-b border-[var(--hair)]">
        <div>
          <div className="h-8 w-40 bg-muted rounded-[2px]" />
          <div className="h-4 w-72 bg-muted/60 rounded mt-2" />
        </div>
        <div className="h-9 w-40 bg-muted rounded-[2px]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[2px] border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-12 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-[2px] border border-border bg-card overflow-hidden">
        <div className="h-9 bg-secondary border-b border-border" />
        <div className="h-9 bg-secondary/60 border-b border-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted/60 rounded" />
            <div className="h-4 w-20 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
