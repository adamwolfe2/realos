export default function NewCreativeLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-28 bg-muted/60 rounded" />
        <div className="h-8 w-52 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/60 rounded" />
      </div>
      <div className="border rounded-md p-5 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-muted/60 rounded" />
            <div className="h-10 w-full bg-muted/40 rounded-md" />
          </div>
        ))}
        <div className="h-32 w-full bg-muted/40 rounded-md" />
        <div className="h-9 w-32 bg-muted rounded-md" />
      </div>
    </div>
  );
}
