export default function ApiKeysLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="space-y-1">
        <div className="h-7 w-24 bg-muted rounded-[2px]" />
        <div className="h-4 w-72 bg-muted/60 rounded-[2px]" />
      </div>
      <div className="ls-card p-5 space-y-4">
        <div className="h-5 w-32 bg-muted rounded-[2px]" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="space-y-1">
              <div className="h-4 w-36 bg-muted rounded-[2px]" />
              <div className="h-3 w-48 bg-muted/50 rounded-[2px]" />
            </div>
            <div className="h-7 w-16 bg-muted/60 rounded-[2px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
