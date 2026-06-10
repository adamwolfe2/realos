import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import {
  parsePropertyFilter,
  effectivePropertyIds,
} from "@/lib/tenancy/property-filter";
import { listPopups, getPopupSummary } from "@/lib/popups/queries";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Popups" };
export const dynamic = "force-dynamic";

export default async function PopupsListPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
  const gate = await requireModule("modulePopups");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;
  // Honor the active-property switcher (and ?propertyId= deep-links from a
  // property's setup checklist) so the list shows this property's popups plus
  // any org-wide popups that apply to every property.
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  const [allPopups, summary] = await Promise.all([
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

  // Filter to the active property when one is selected. Org-wide popups
  // (propertyId === null) always show since they fire on every property.
  const popups =
    effectiveIds && effectiveIds.length > 0
      ? allPopups.filter(
          (p) => p.propertyId === null || effectiveIds.includes(p.propertyId),
        )
      : allPopups;

  // Bucket the campaign list by status so the KPI strip reads honestly
  // for low-volume tenants (one active campaign on day one shouldn't
  // count as "drafts, live, and paused").
  const activeCount = popups.filter((p) => p.status === "ACTIVE").length;
  const pausedCount = popups.filter((p) => p.status === "PAUSED").length;
  const draftCount = popups.filter((p) => p.status === "DRAFT").length;

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        title="Popups"
        description="Design promo, referral, and discount popups that you can paste on any external site with a single script tag. Every render and conversion writes back to your lead pipeline."
        actions={
          <Link
            href="/portal/popups/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New popup
          </Link>
        }
      />

      {/* KPI strip */}
      <section
        aria-label="Popup performance at a glance"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          label="Active campaigns"
          value={summary.totalCampaigns.toLocaleString()}
          hint={
            summary.totalCampaigns === 0
              ? "Create your first"
              : `${activeCount} active · ${pausedCount + draftCount} not live`
          }
        />
        <KpiTile
          label="Shown (28d)"
          value={summary.shown28d.toLocaleString()}
          hint={
            summary.shownAllTime === 0
              ? "No impressions yet"
              : `${summary.shownAllTime.toLocaleString()} all-time`
          }
        />
        <KpiTile
          label="CTA clicks (28d)"
          value={summary.ctaClicks28d.toLocaleString()}
          hint={
            summary.ctaClickAllTime > 0
              ? `${summary.ctaClickAllTime.toLocaleString()} all-time`
              : "No clicks yet"
          }
        />
        <KpiTile
          label="Conversion rate"
          value={
            summary.conversionRatePct != null
              ? `${summary.conversionRatePct}%`
              : "—"
          }
          hint={
            summary.convertedAllTime > 0
              ? `${summary.convertedAllTime.toLocaleString()} converted`
              : "No conversions yet"
          }
        />
      </section>

      {/* List */}
      {popups.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Design your first popup"
          body="Promos, referrals, discounts, application reminders — popups capture intent at the exact moment a visitor is about to leave. Every conversion attributes back to this campaign in your lead pipeline."
          action={{ label: "Create popup", href: "/portal/popups/new" }}
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
          {/* Inline "Create another" affordance so operators can stack
              campaigns from the list without scrolling back to the
              header. Hidden on the empty-state branch (handled by
              EmptyState's primary CTA above). */}
          <div className="mt-3 pt-3 border-t border-border flex justify-end">
            <Link
              href="/portal/popups/new"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Create another
            </Link>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Lowercase, rounded-md, 11px text — matches the portal-wide status
  // pill grammar (no emerald/amber rainbow; tone communicated via
  // brand-primary vs neutral instead).
  const tone =
    status === "ACTIVE"
      ? "bg-primary/10 text-primary"
      : status === "PAUSED"
        ? "bg-muted text-muted-foreground border border-border"
        : status === "ARCHIVED"
          ? "bg-muted text-muted-foreground"
          : "bg-card text-muted-foreground border border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium lowercase",
        tone,
      )}
    >
      {status.toLowerCase()}
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
