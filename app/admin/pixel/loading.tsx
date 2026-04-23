export default function PixelHealthLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-36 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-8 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="px-4 py-2.5">
                    <div className="h-3 w-16 bg-muted/60 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="h-4 w-36 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-24 bg-muted/60 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-muted/50 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-muted/60 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-muted/40 rounded ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-muted/40 rounded ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-muted/40 rounded ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
