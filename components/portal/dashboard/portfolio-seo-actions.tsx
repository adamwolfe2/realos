import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SeoActionItem = {
  id: string;
  title: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  estimateMinutes: number;
  actionHref: string | null;
  actionLabel: string | null;
  category: string;
  propertyId: string | null;
  propertyName: string | null;
};

type Props = {
  actions: SeoActionItem[];
};

// Severity is reflected purely through list ORDER (the caller sorts
// CRITICAL → HIGH → MEDIUM → LOW upstream). No visible badges — the
// stressful red-outlined treatment was pulled per operator feedback.
// Operators still get prioritization; they just don't get yelled at.

// ---------------------------------------------------------------------------
// Portfolio-wide SEO recommendations strip for /portal. Reads the
// (already cached) SeoActionRecommendation table. Sibling to
// DashboardActionItems — that's the Intelligence engine; this is the
// SEO Agent engine. Distinct because the SEO engine has richer
// per-property context (CTR fixes per query, AEO gaps, etc.).
//
// Server component — no client JS. Renders nothing when the list is empty.
// ---------------------------------------------------------------------------
export function PortfolioSeoActions({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <section className="rounded-[2px] border border-[#e0e0e0] bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#e0e0e0] bg-[#f4f4f4]">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-[#525252]">
            SEO Agent
          </p>
          <h3 className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">
            Top SEO actions across your portfolio
          </h3>
        </div>
        <Link
          href="/portal/seo/agent"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Open Agent
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </header>
      <ul className="divide-y divide-[#e0e0e0]">
        {actions.map((a) => (
          <li key={a.id}>
            <Link
              href={a.actionHref ?? "/portal/seo/agent"}
              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {a.propertyName ? (
                    <>
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-muted-foreground">
                        {a.propertyName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        ·
                      </span>
                    </>
                  ) : null}
                  <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-muted-foreground">
                    {a.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    ·
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    ~{a.estimateMinutes} min
                  </span>
                </div>
                <p className="text-[12.5px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {a.title}
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                {a.actionLabel ?? "Open"}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
