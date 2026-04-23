export default function AuditLogLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-4 w-64 bg-muted/60 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-48 bg-muted rounded-md" />
        <div className="h-8 w-32 bg-muted rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-4 py-2.5">
                  <div className="h-3 w-16 bg-muted/60 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="h-4 w-24 bg-muted/50 rounded" /></td>
                <td className="px-4 py-3"><div className="h-5 w-28 bg-muted rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-36 bg-muted/60 rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-28 bg-muted/40 rounded" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 bg-muted/40 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
