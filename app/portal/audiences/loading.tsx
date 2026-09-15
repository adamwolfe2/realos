export default function AudiencesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-32 bg-muted rounded-[2px]" />
        <div className="h-4 w-80 bg-muted/60 rounded-[2px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ls-card p-4 space-y-2">
            <div className="h-4 w-24 bg-muted/70 rounded-[2px]" />
            <div className="h-7 w-16 bg-muted rounded-[2px]" />
            <div className="h-3 w-32 bg-secondary rounded-[2px]" />
          </div>
        ))}
      </div>
      <div className="ls-card p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="h-4 w-1/3 bg-muted rounded-[2px]" />
              <div className="h-3 w-1/2 bg-secondary rounded-[2px]" />
            </div>
            <div className="h-7 w-16 bg-muted/60 rounded-[2px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
