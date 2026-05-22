import Link from "next/link";
import { AlertCircle } from "lucide-react";

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

// Outlined, high-contrast severity pills. The old beige-on-cream variant
// disappeared visually next to the rest of the dashboard — these pop with
// a saturated outline + bold uppercase text so an operator's eye lands on
// CRITICAL the moment the page paints.
const SEV_TONE: Record<string, string> = {
  CRITICAL:
    "bg-white text-red-700 border border-red-400 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700",
  HIGH:
    "bg-white text-amber-700 border border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  MEDIUM: "bg-white text-foreground border border-border",
  LOW: "bg-white text-muted-foreground border border-border",
};

const SEV_ICON: Record<string, boolean> = {
  CRITICAL: true,
  HIGH: true,
};

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
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-gradient-to-r from-primary/[0.05] via-card to-card">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            SEO Agent
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            Top SEO actions across your portfolio
          </h3>
        </div>
        <Link
          href="/portal/seo/agent"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Open Agent →
        </Link>
      </header>
      <ul className="divide-y divide-border/60">
        {actions.map((a) => (
          <li key={a.id} className="px-4 py-2.5">
            <Link
              href={a.actionHref ?? "/portal/seo/agent"}
              className="flex items-start gap-3 group"
            >
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  SEV_TONE[a.severity] ?? SEV_TONE.MEDIUM
                }`}
              >
                {SEV_ICON[a.severity] ? (
                  <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                ) : null}
                {a.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {a.title}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground line-clamp-1">
                  {a.propertyName ? `${a.propertyName} · ` : ""}
                  <span className="font-mono uppercase tracking-wide">
                    {a.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  {" · "}
                  ~{a.estimateMinutes}m
                </p>
              </div>
              <span className="shrink-0 self-center text-[11px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                {a.actionLabel ?? "Open"} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
