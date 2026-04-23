export default function AppFolioLoading() {
  return (
    <div className="space-y-6 max-w-2xl animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-32 bg-muted/60 rounded" />
        <div className="h-8 w-56 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded" />
      </div>
      <div className="border rounded-md p-5 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 bg-muted/60 rounded" />
            <div className="h-10 w-full bg-muted/40 rounded-md" />
          </div>
        ))}
        <div className="flex gap-3 pt-3 border-t">
          <div className="h-9 w-16 bg-muted rounded-md" />
          <div className="h-9 w-24 bg-muted/60 rounded-md" />
        </div>
      </div>
    </div>
  );
}
