export default function SiteBuilderLoading() {
  return (
    <div className="space-y-6 animate-pulse pb-24">
      <div className="space-y-1">
        <div className="h-7 w-32 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      {Array.from({ length: 4 }).map((_, section) => (
        <div key={section} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-10 w-full bg-muted rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur p-4">
        <div className="max-w-5xl mx-auto flex justify-end gap-3">
          <div className="h-9 w-24 bg-muted rounded-md" />
          <div className="h-9 w-28 bg-muted rounded-md" />
        </div>
      </div>
    </div>
  );
}
