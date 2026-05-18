import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { listPopups, getPopupSummary } from "@/lib/popups/queries";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { createPopupFromForm } from "@/lib/actions/popup-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Popups" };
export const dynamic = "force-dynamic";

export default async function PopupsListPage() {
  const scope = await requireScope();
  const [popups, summary] = await Promise.all([
    listPopups(scope.orgId).catch(() => []),
    getPopupSummary(scope.orgId).catch(() => ({
      totalCampaigns: 0,
      shownAllTime: 0,
      convertedAllTime: 0,
      ctaClickAllTime: 0,
      dismissedAllTime: 0,
      conversionRatePct: null as number | null,
      shown28d: 0,
      converted28d: 0,
      ctaClicks28d: 0,
    })),
  ]);

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        title="Popups"
        description="Design promo, referral, and discount popups that you can paste on any external site with a single script tag. Every render and conversion writes back to your lead pipeline."
        actions={
          <form action={createPopupFromForm}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New popup
            </button>
          </form>
        }
      />

      {/* KPI strip */}
      <section
        aria-label="Popup performance at a glance"
        className="grid grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          label="Active campaigns"
          value={summary.totalCampaigns.toLocaleString()}
          hint={summary.totalCampaigns === 0 ? "Create your first" : "Drafts, live, and paused"}
        />
        <KpiTile
          label="Shown (28d)"
          value={summary.shown28d.toLocaleString()}
          hint={`${summary.shownAllTime.toLocaleString()} all-time`}
        />
        <KpiTile
          label="CTA clicks (28d)"
          value={summary.ctaClicks28d.toLocaleString()}
          hint={summary.ctaClickAllTime > 0 ? `${summary.ctaClickAllTime.toLocaleString()} all-time` : "—"}
        />
        <KpiTile
          label="Conversion rate"
          value={
            summary.conversionRatePct != null
              ? `${summary.conversionRatePct}%`
              : "—"
          }
          hint={`${summary.convertedAllTime.toLocaleString()} converted`}
        />
      </section>

      {/* List */}
      {popups.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Design your first popup"
          body="Promos, referrals, discounts, application reminders — popups capture intent at the exact moment a visitor is about to leave. Every conversion attributes back to this campaign in your lead pipeline."
          action={{ label: "Create popup", href: "/portal/popups" }}
        />
      ) : (
        <SectionCard label="All popups" description="Click a row to edit copy, design, triggers, capture, and targeting.">
          <ul className="divide-y divide-border -mx-1">
            {popups.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/portal/popups/${p.id}`}
                  className="group flex items-center gap-3 px-1 py-3 -mx-0.5 rounded-md hover:bg-muted/30 transition-colors"
                >
                  {/* Color swatch */}
                  <span
                    aria-hidden="true"
                    className="shrink-0 h-9 w-9 rounded-lg border border-black/5 flex items-center justify-center text-white text-xs font-bold uppercase"
                    style={{ backgroundColor: p.primaryColor }}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </span>
                      <StatusBadge status={p.status} />
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                      "{p.headline}" · {formatTrigger(p.trigger)} · {formatPosition(p.position)}
                    </span>
                  </span>
                  <span className="hidden md:flex items-baseline gap-4 text-[11px] tabular-nums shrink-0 mr-2">
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
                        Shown
                      </span>
                      <span className="block font-semibold text-foreground">
                        {p.shownCount.toLocaleString()}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
                        Clicks
                      </span>
                      <span className="block font-semibold text-foreground">
                        {p.ctaClickCount.toLocaleString()}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
                        Converted
                      </span>
                      <span className="block font-semibold text-foreground">
                        {p.convertedCount.toLocaleString()}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "PAUSED"
        ? "bg-amber-50 text-amber-700"
        : status === "ARCHIVED"
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
        tone,
      )}
    >
      {status}
    </span>
  );
}

function formatTrigger(t: string): string {
  switch (t) {
    case "EXIT_INTENT":
      return "Exit intent";
    case "SCROLL_DEPTH":
      return "Scroll depth";
    case "TIME_ON_PAGE":
      return "Time on page";
    case "IDLE_TIME":
      return "Idle time";
    case "IMMEDIATE":
      return "Immediate";
    default:
      return t;
  }
}

function formatPosition(p: string): string {
  switch (p) {
    case "CENTER":
      return "Center";
    case "BOTTOM_RIGHT":
      return "Bottom right";
    case "BOTTOM_LEFT":
      return "Bottom left";
    case "TOP_BANNER":
      return "Top banner";
    default:
      return p;
  }
}
