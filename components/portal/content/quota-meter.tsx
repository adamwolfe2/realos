// ---------------------------------------------------------------------------
// QuotaMeter — compact monthly content usage card for /portal/content.
//
// Server component. Receives a QuotaSnapshot from the page and renders
// horizontal bars for every format that has a finite cap (< 999). Formats
// with unlimited quota are dropped from the list to keep the card scannable.
//
// Styling intentionally matches the LeaseStack portal aesthetic: thin
// progress bar, muted track, brand-blue fill, no emoji, no shadow drama.
// ---------------------------------------------------------------------------

import type { ContentFormat } from "@prisma/client";
import type { QuotaSnapshot } from "@/lib/content/quota";
import { ALL_FORMATS, QUOTA_UNLIMITED } from "@/lib/content/quota";

const FORMAT_LABEL: Record<ContentFormat, string> = {
  BLOG_POST: "Blog posts",
  NEIGHBORHOOD_PAGE: "Neighborhood pages",
  PROPERTY_DESCRIPTION: "Property descriptions",
  META_REWRITE: "Meta rewrites",
  FAQ_BLOCK: "FAQ blocks",
  AD_COPY: "Ad copy",
};

function formatResetDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function QuotaMeter({ snapshot }: { snapshot: QuotaSnapshot }) {
  const visible = ALL_FORMATS.filter(
    (format) => snapshot.limits[format] < QUOTA_UNLIMITED,
  );

  return (
    <section
      aria-label="Monthly content usage"
      className="rounded-lg border border-border bg-card p-4"
    >
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          This month's content
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {snapshot.planTier}
        </span>
      </header>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Unlimited drafts on this plan. Generate freely.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((format) => {
            const limit = snapshot.limits[format];
            const used = Math.min(snapshot.used[format], limit);
            const pct = limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
            const exhausted = used >= limit;
            return (
              <li key={format} className="text-xs">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-foreground">{FORMAT_LABEL[format]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {used} / {limit}
                  </span>
                </div>
                <div
                  className="h-1 w-full rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-label={`${FORMAT_LABEL[format]} usage`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: exhausted
                        ? "var(--terracotta, #c25b46)"
                        : "var(--brand, #2563eb)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Resets {formatResetDate(snapshot.nextPeriodStart)}
      </p>
    </section>
  );
}
