import Link from "next/link";
import { Star } from "lucide-react";
import type { PortfolioReputationMetrics } from "@/lib/reputation/portfolio";
import { safeNum, fmtInt, fmtRating } from "@/components/portal/reputation/reputation-utils";

// Single-line property row for the analytics drawer. Replaces the wide
// table with a compact "Name · ★ · reviews · mentions · negative → Open"
// line that fits the single-tenant common case without burning vertical
// space.
export function PropertySummaryRow({
  property: p,
}: {
  property: PortfolioReputationMetrics["propertyHealth"][number];
}) {
  return (
    <li>
      <Link
        href={`/portal/properties/${p.propertyId}?tab=reputation`}
        className="flex items-center gap-2 rounded-[2px] px-2 py-1.5 -mx-2 text-xs hover:bg-secondary transition-colors"
      >
        <span className="font-medium text-foreground truncate">
          {p.propertyName ?? "Property"}
        </span>
        <span className="text-muted-foreground">·</span>
        {p.googleRating != null && safeNum(p.googleRating) > 0 ? (
          <>
            <span className="inline-flex items-center gap-0.5 text-foreground tabular-nums">
              <Star className="h-3 w-3 fill-current text-primary" />
              {fmtRating(p.googleRating)}
            </span>
            <span className="text-muted-foreground">·</span>
          </>
        ) : null}
        <span className="text-muted-foreground tabular-nums">
          {fmtInt(p.googleReviewCount)} reviews
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground tabular-nums">
          {fmtInt(p.totalMentions)} mentions
        </span>
        {safeNum(p.negativeCount) > 0 ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-foreground tabular-nums">
              {fmtInt(p.negativeCount)} negative
            </span>
          </>
        ) : null}
        {safeNum(p.unreviewedCount) > 0 ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground tabular-nums">
              {fmtInt(p.unreviewedCount)} unreviewed
            </span>
          </>
        ) : null}
        <span className="ml-auto text-foreground hover:text-primary whitespace-nowrap">
          Open →
        </span>
      </Link>
    </li>
  );
}
