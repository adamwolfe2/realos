import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  FileInput,
  Kanban,
  Activity,
  Brush,
  Megaphone,
  MessageSquare,
  AlertTriangle,
  AlertOctagon,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
} from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus } from "@prisma/client";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import {
  getAgencyMoney,
  getAdminActionItems,
  getTenantLeaderboard,
  type AdminActionItem,
  type AdminActionSeverity,
  type TenantLeaderRow,
} from "@/lib/admin/insights";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanTenantStatus, tenantStatusTone } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Agency overview" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// /admin — Agency Overview
//
// Rebuilt around real signal after operator feedback that the previous
// "Action inbox" + "Tenant funnel" + "Recent intakes" stack was a wall
// of zeros. The new layout leads with money + a ranked list of CONCRETE
// actions ("SG Real Estate: AppFolio sync failing") instead of abstract
// counters ("3 at-risk clients").
//
// Sections (top to bottom):
//   1. MRR strip                 — total MRR, active count, at-risk MRR, MoM
//   2. Needs your attention      — ranked AdminActionItem list (critical →
//                                  warning → info), each row links straight
//                                  to the actionable surface
//   3. Live tenant leaderboard   — top tenants by 7d lead velocity, with a
//                                  trend arrow vs the trailing 28d average
//   4. Funnel + Recent + Jump-to — the legacy panels, now compact and below
//                                  the fold so a calm "you're caught up"
//                                  state still leaves the page useful
// ---------------------------------------------------------------------------

export default async function AdminHome() {
  await requireAgency();

  const since30d = new Date(Date.now() - 30 * DAY);

  const [
    money,
    actionItems,
    leaderboard,
    pipelineCounts,
    leadsThisMonth,
    intakePending,
    intakeNewToday,
    openCreative,
    recentSubmissions,
  ] = await Promise.all([
    getAgencyMoney().catch(() => ({
      totalMrrCents: 0,
      activeMrrCents: 0,
      atRiskMrrCents: 0,
      pausedMrrCents: 0,
      activeCount: 0,
      atRiskCount: 0,
      pausedCount: 0,
      launched30d: 0,
      churned30d: 0,
    })),
    getAdminActionItems(10).catch(() => [] as AdminActionItem[]),
    getTenantLeaderboard(6).catch(() => [] as TenantLeaderRow[]),
    prisma.organization
      .groupBy({
        by: ["status"],
        where: { orgType: OrgType.CLIENT },
        _count: { id: true },
      })
      .catch(() => []),
    prisma.lead.count({ where: { createdAt: { gte: since30d } } }).catch(() => 0),
    prisma.intakeSubmission
      .count({ where: { reviewedAt: null, convertedAt: null } })
      .catch(() => 0),
    prisma.intakeSubmission
      .count({ where: { submittedAt: { gte: new Date(Date.now() - DAY) } } })
      .catch(() => 0),
    prisma.creativeRequest
      .count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] } } })
      .catch(() => 0),
    prisma.intakeSubmission
      .findMany({ orderBy: { submittedAt: "desc" }, take: 5 })
      .catch(() => []),
  ]);

  const statusMap = new Map(
    pipelineCounts.map((r) => [r.status, r._count?.id ?? 0] as const),
  );

  const totalTenants =
    money.activeCount +
    money.atRiskCount +
    money.pausedCount +
    (statusMap.get(TenantStatus.BUILD_IN_PROGRESS) ?? 0) +
    (statusMap.get(TenantStatus.CONTRACT_SIGNED) ?? 0) +
    (statusMap.get(TenantStatus.QA) ?? 0);

  const criticalCount = actionItems.filter((i) => i.severity === "critical").length;
  const warningCount = actionItems.filter((i) => i.severity === "warning").length;

  return (
    <div className="space-y-5 max-w-7xl">
      <PageHeader
        title="Agency overview"
        description={
          totalTenants === 0
            ? "No tenants yet — capture your first intake to start the pipeline."
            : `${totalTenants} tenant${totalTenants === 1 ? "" : "s"} live across the agency.`
        }
        actions={
          <Link
            href="/admin/pipeline"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Open pipeline
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />

      {/* ──────────────────────────────────────────────────────────────
          1. MRR strip — leads with money. Each tile renders both the
             value and a contextual sub-line (count, delta) so it's
             actually decision-useful instead of a number floating
             alone.
          ────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyTile
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Total MRR"
          value={formatMoney(money.totalMrrCents)}
          hint={`${money.activeCount} active${money.atRiskCount > 0 ? ` · ${money.atRiskCount} at-risk` : ""}`}
        />
        <MoneyTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Active MRR"
          value={formatMoney(money.activeMrrCents)}
          hint={`${money.launched30d} launched in 30d`}
          tone="positive"
        />
        <MoneyTile
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="At-risk MRR"
          value={formatMoney(money.atRiskMrrCents)}
          hint={
            money.atRiskCount > 0
              ? `${money.atRiskCount} client${money.atRiskCount === 1 ? "" : "s"} flagged`
              : "Nothing flagged"
          }
          tone={money.atRiskCount > 0 ? "warn" : undefined}
        />
        <MoneyTile
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Churn (30d)"
          value={`${money.churned30d}`}
          hint={money.pausedCount > 0 ? `${money.pausedCount} paused` : "Steady"}
          tone={money.churned30d > 0 ? "warn" : undefined}
        />
      </section>

      {/* ──────────────────────────────────────────────────────────────
          2. Needs your attention — the heart of the page. Replaces the
             old empty-by-default "Action inbox" tiles with concrete
             rows like "SG Real Estate: AppFolio sync failing → fix".
             Severity badge on the left, tenant tag inline, "X days ago"
             on the right.
          ────────────────────────────────────────────────────────── */}
      <SectionCard
        label="Needs your attention"
        description={
          actionItems.length === 0
            ? "Nothing flagged — every tenant is green."
            : `${criticalCount} critical · ${warningCount} warning${actionItems.length > criticalCount + warningCount ? ` · ${actionItems.length - criticalCount - warningCount} info` : ""}`
        }
        action={
          actionItems.length > 0 ? (
            <Link
              href="/admin/insights"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all →
            </Link>
          ) : null
        }
      >
        {actionItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">All clear.</p>
            <p className="text-xs text-muted-foreground mt-1">
              No stale intakes, failed integrations, or at-risk clients. We'll
              flag the next issue here automatically.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {actionItems.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ──────────────────────────────────────────────────────────
            3. Live tenant leaderboard — who's growing, who's not.
               7d lead count → trend arrow against the trailing 28d
               weekly average so growth/decline is visible at a glance.
            ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <SectionCard
            label="Tenant leaderboard"
            description="Lead velocity over the last 7 days vs the trailing 4-week average."
            action={
              <Link
                href="/admin/clients"
                className="text-xs font-semibold text-primary hover:underline"
              >
                All clients →
              </Link>
            }
          >
            {leaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Leaderboard fills out once a tenant has at least one lead in
                the last 28 days.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {leaderboard.map((row) => (
                  <LeaderboardRow key={row.orgId} row={row} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Compact ops counters — Pending intakes, open creative, leads MTD,
            and quick-jump links. The previous large tile grid moved here
            because money + actions deserve the top fold. */}
        <SectionCard label="Operations">
          <ul className="space-y-2">
            <OpsRow
              href="/admin/intakes"
              icon={<FileInput className="h-3.5 w-3.5" />}
              label="Pending intakes"
              count={intakePending}
              subLabel={
                intakeNewToday > 0 ? `${intakeNewToday} new today` : undefined
              }
            />
            <OpsRow
              href="/admin/creative-requests"
              icon={<Brush className="h-3.5 w-3.5" />}
              label="Open creative"
              count={openCreative}
            />
            <OpsRow
              href="/admin/leads"
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Leads (30d)"
              count={leadsThisMonth}
            />
            <OpsRow
              href="/admin/pipeline"
              icon={<Kanban className="h-3.5 w-3.5" />}
              label="Pipeline board"
            />
            <OpsRow
              href="/admin/clients"
              icon={<Users className="h-3.5 w-3.5" />}
              label="All clients"
            />
            <OpsRow
              href="/admin/campaigns"
              icon={<Megaphone className="h-3.5 w-3.5" />}
              label="Ad campaigns"
            />
            <OpsRow
              href="/admin/chat"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Support chat"
            />
          </ul>
        </SectionCard>
      </div>

      {/* Recent intakes — kept but compact, sits below the fold. */}
      <SectionCard
        label="Recent intakes"
        action={
          <Link
            href="/admin/intakes"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all →
          </Link>
        }
      >
        {recentSubmissions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No intake submissions yet. Share your intake form to start filling
            the pipeline.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentSubmissions.map((s) => {
              const isHot = !s.reviewedAt && !s.convertedAt;
              const initial = (s.companyName ?? "?").slice(0, 1).toUpperCase();
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/intakes/${s.id}`}
                    className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium truncate">
                        {s.companyName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.propertyType}
                        {s.currentBackendPlatform
                          ? ` · ${s.currentBackendPlatform}`
                          : ""}
                      </p>
                    </div>
                    {isHot ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-primary bg-primary/10">
                        New
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-14 text-right">
                      {formatDistanceToNow(s.submittedAt, { addSuffix: false })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MoneyTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={
            "inline-flex h-6 w-6 items-center justify-center rounded-md " +
            (tone === "warn"
              ? "bg-amber-50 text-amber-700"
              : tone === "positive"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-primary/10 text-primary")
          }
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground leading-none">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ActionRow({ item }: { item: AdminActionItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-start gap-3 py-3 px-1 -mx-1 rounded-md hover:bg-muted/30 transition-colors group"
      >
        <SeverityIcon severity={item.severity} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.detail}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.occurredAt ? (
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}
            </span>
          ) : null}
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </li>
  );
}

function SeverityIcon({ severity }: { severity: AdminActionSeverity }) {
  if (severity === "critical") {
    return (
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10 text-destructive shrink-0">
        <AlertOctagon className="h-3.5 w-3.5" aria-label="Critical" />
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5" aria-label="Warning" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
      <Info className="h-3.5 w-3.5" aria-label="Info" />
    </span>
  );
}

function LeaderboardRow({ row }: { row: TenantLeaderRow }) {
  const TrendArrow =
    row.velocityDelta > 0
      ? TrendingUp
      : row.velocityDelta < 0
        ? TrendingDown
        : Minus;
  const trendClass =
    row.velocityDelta > 0
      ? "text-emerald-700"
      : row.velocityDelta < 0
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <li>
      <Link
        href={`/admin/clients/${row.orgId}`}
        className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-md hover:bg-muted/30 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {row.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {row.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge tone={tenantStatusTone(row.status)}>
              {humanTenantStatus(row.status)}
            </StatusBadge>
            {row.mrrCents > 0 ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                ${Math.round(row.mrrCents / 100).toLocaleString()}/mo
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {row.leads7d}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              7d
            </span>
          </p>
          <p
            className={`text-[10px] font-medium tabular-nums inline-flex items-center gap-0.5 ${trendClass}`}
          >
            <TrendArrow className="h-2.5 w-2.5" aria-hidden="true" />
            {row.velocityDelta > 0 ? "+" : ""}
            {row.velocityDelta}
          </p>
        </div>
      </Link>
    </li>
  );
}

function OpsRow({
  href,
  icon,
  label,
  count,
  subLabel,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  subLabel?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-md hover:bg-muted/40 transition-colors group"
      >
        <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-sm text-foreground">{label}</span>
          {subLabel ? (
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              · {subLabel}
            </span>
          ) : null}
        </div>
        {count != null ? (
          <span
            className={
              "text-sm tabular-nums tabular-nums shrink-0 " +
              (count > 0 ? "font-semibold text-foreground" : "text-muted-foreground/50")
            }
          >
            {count}
          </span>
        ) : (
          <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
        )}
      </Link>
    </li>
  );
}

function formatMoney(cents: number): string {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 10_000) {
    return `$${Math.round(dollars / 1_000)}k`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}
