// ---------------------------------------------------------------------------
// Renewal timeline — horizontal 4-bucket stack.
// ---------------------------------------------------------------------------

export function RenewalTimeline({
  buckets,
  total,
}: {
  buckets: Array<{ label: string; count: number; rentCents: number }>;
  total: number;
}) {
  // Opacity ramps down from urgent (0-30d) to far-out (91-120d).
  // Hand-picked Tailwind opacity classes so we don't depend on the
  // CSS `rgb(from …)` relative-color syntax landing in every browser.
  const tones = [
    "bg-primary/15 border-primary/30",
    "bg-primary/10 border-primary/20",
    "bg-primary/[0.06] border-border",
    "bg-secondary border-border",
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Next 120 days
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Renewal pipeline
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total === 0
            ? "Nothing in window"
            : `${total} ${total === 1 ? "lease" : "leases"}`}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-[12px] text-muted-foreground leading-snug">
          No leases expiring in the next 120 days. Renewal cohorts appear here
          as lease end dates enter the window.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {buckets.map((b, i) => (
            <div
              key={b.label}
              className={`rounded-lg border px-3 py-2.5 min-w-0 ${tones[i]}`}
            >
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                {b.label}
              </p>
              <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
                {b.count.toLocaleString()}
                <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">
                  {b.count === 1 ? "lease" : "leases"}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums truncate">
                {b.rentCents > 0
                  ? `$${Math.round(b.rentCents / 100).toLocaleString()}/mo`
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
