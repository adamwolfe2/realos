import Link from "next/link";

// ---------------------------------------------------------------------------
// StatusChipStrip — shared filter-chip row with a count bubble. Extracted
// from /portal/seo/drafts so any list page with a status/category filter can
// reuse it. Presentational + server-safe (plain <Link>s, no client state).
//
// Fixes a canon violation from the original: chips used rounded-lg; canon is
// rounded-[2px] everywhere except pill/dot shapes — the count bubble keeps
// rounded-full since it's a numeric badge, not a chip.
// ---------------------------------------------------------------------------

export type StatusChipStripItem = {
  label: string;
  href: string;
  count: number;
  active: boolean;
};

export function StatusChipStrip({ items }: { items: StatusChipStripItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          // Filter chips must not jump the window to top on every click —
          // same as DataTable's own sort headers.
          scroll={false}
          className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            item.active
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {item.label}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {item.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
