import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
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
  getTenantSegments,
  type AdminActionItem,
  type AdminActionSeverity,
  type TenantLeaderRow,
  type TenantOnboardingRow,
  type TenantSegments,
} from "@/lib/admin/insights";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanTenantStatus, tenantStatusTone } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agency overview" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// /admin — Agency Overview
//
// Rebuilt 2026-07-24 after operator feedback that the previous layout was
// "a lot of slop": duplicate MRR tiles, a buried attention queue, a 5-row
// leaderboard of zeros (mostly internal test workspaces), a 3rd "Operations"
// panel repeating the same leads number, and an empty "Recent intakes" card
// with a stray loading sliver.
//
// Sections (top to bottom):
//   1. MRR strip            — Total MRR · At-risk MRR · Churn(30d) · Launched(30d)
//   2. Needs your attention — the SOUL of the page. Full width, directly
//                             under the KPI strip, severity-grouped, each
//                             row's age escalates in color, real button
//                             affordance instead of a bare arrow. Pending
//                             intakes / open creative live here as chips.
//   3. Active tenants / Onboarding — split so a pre-launch tenant never
//                             shows a fake "0 leads" column, and both lists
//                             filter out internal/test workspaces.
//   4. Recent intakes       — only renders when there's something to show.
// ---------------------------------------------------------------------------

export default async function AdminHome() {
  await requireAgency();

  const [money, actionItems, segments, pipelineCounts, intakePending, openCreative, recentSubmissions] =
    await Promise.all([
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
      getTenantSegments(6).catch(
        () => ({ active: [], onboarding: [], internalHiddenCount: 0 }) as TenantSegments,
      ),
      prisma.organization
        .groupBy({
          by: ["status"],
          where: { orgType: OrgType.CLIENT },
          _count: { id: true },
        })
        .catch(() => []),
      prisma.intakeSubmission
        .count({ where: { reviewedAt: null, convertedAt: null } })
        .catch(() => 0),
      prisma.creativeRequest
        .count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] } } })
        .catch(() => 0),
      prisma.intakeSubmission
        .findMany({
          orderBy: { submittedAt: "desc" },
          take: 5,
          // Explicit select keeps the dashboard payload tight — Intake
          // submissions carry several large Text/Json columns this card
          // never reads.
          select: {
            id: true,
            companyName: true,
            propertyType: true,
            currentBackendPlatform: true,
            submittedAt: true,
            reviewedAt: true,
            convertedAt: true,
          },
        })
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

  const criticalItems = actionItems.filter((i) => i.severity === "critical");
  const warningItems = actionItems.filter((i) => i.severity === "warning");
  const infoItems = actionItems.filter((i) => i.severity === "info");

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full">
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
          1. MRR strip — one consolidated set of 4 tiles. No more
             Total MRR / Active MRR duplicates: Total MRR carries the
             active+at-risk breakdown in its own subtitle, and At-risk
             MRR reads coherently even when the flagged client hasn't
             lost dollars yet ($0 MRR but 1 client flagged).
          ────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyTile
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Total MRR"
          value={formatMoney(money.totalMrrCents)}
          hint={`${money.activeCount} active${money.atRiskCount > 0 ? ` · ${money.atRiskCount} at-risk` : ""}`}
        />
        <MoneyTile
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="At-risk MRR"
          value={
            money.atRiskCount === 0
              ? "$0"
              : money.atRiskMrrCents > 0
                ? formatMoney(money.atRiskMrrCents)
                : `${money.atRiskCount} client${money.atRiskCount === 1 ? "" : "s"}`
          }
          hint={
            money.atRiskCount === 0
              ? "Nothing flagged"
              : money.atRiskMrrCents > 0
                ? `${money.atRiskCount} client${money.atRiskCount === 1 ? "" : "s"} flagged`
                : "flagged at-risk · $0 MRR"
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
        <MoneyTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Launched (30d)"
          value={`${money.launched30d}`}
          hint={`${money.activeCount} active total`}
          tone={money.launched30d > 0 ? "positive" : undefined}
        />
      </section>

      {/* ──────────────────────────────────────────────────────────────
          2. Needs your attention — the soul of the page. Full width,
             directly under the KPI strip. Severity-grouped (critical
             first), each row's age escalates in color, and pending
             intakes / open creative surface as compact chips in the
             header instead of their own duplicate "Operations" panel.
          ────────────────────────────────────────────────────────── */}
      <SectionCard
        label="Needs your attention"
        description={
          actionItems.length === 0
            ? "Nothing flagged — every tenant is green."
            : `${criticalItems.length} critical · ${warningItems.length} warning${infoItems.length > 0 ? ` · ${infoItems.length} info` : ""}`
        }
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <OpsChip href="/admin/intakes" label="pending intakes" count={intakePending} />
            <OpsChip href="/admin/creative-requests" label="open creative" count={openCreative} />
            {actionItems.length > 0 ? (
              <Link
                href="/admin/insights"
                className="text-xs font-semibold text-primary hover:underline ml-1"
              >
                View all →
              </Link>
            ) : null}
          </div>
        }
      >
        {actionItems.length === 0 ? (
          <div className="rounded-[2px] border border-dashed border-[var(--hair-strong)] bg-secondary px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">All clear.</p>
            <p className="text-xs text-muted-foreground mt-1">
              No stale intakes, failed integrations, or at-risk clients. We'll
              flag the next issue here automatically.
            </p>
          </div>
        ) : (
          <div>
            <ActionGroup severity="critical" items={criticalItems} />
            <ActionGroup severity="warning" items={warningItems} />
            <ActionGroup severity="info" items={infoItems} />
          </div>
        )}
      </SectionCard>

      {/* ──────────────────────────────────────────────────────────────
          3. Active tenants / Onboarding — replaces the old single
             leaderboard (which mixed pre-launch pipeline rows in and
             read as 5 columns of zeros). Active tenants get real lead
             velocity + trend; Onboarding gets a stage badge only — no
             fake zero-velocity columns for tenants with no live pixel
             yet. Both filter out internal/test workspaces.
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          label="Active tenants"
          description="Lead velocity — last 7 days vs the trailing 4-week average."
          action={
            <Link
              href="/admin/clients"
              className="text-xs font-semibold text-primary hover:underline"
            >
              All clients →
            </Link>
          }
        >
          {segments.active.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No live tenants yet — this fills out once a tenant launches.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {segments.active.map((row) => (
                <LeaderboardRow key={row.orgId} row={row} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          label="Onboarding"
          description="Pipeline stage — clients not yet live."
          action={
            <Link
              href="/admin/pipeline"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Pipeline →
            </Link>
          }
        >
          {segments.onboarding.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nothing in the onboarding pipeline right now.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {segments.onboarding.map((row) => (
                <OnboardingRow key={row.orgId} row={row} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {segments.internalHiddenCount > 0 ? (
        <p className="text-[11px] text-muted-foreground px-1">
          {segments.internalHiddenCount} internal workspace
          {segments.internalHiddenCount === 1 ? "" : "s"} hidden ·{" "}
          <Link href="/admin/clients" className="font-medium text-primary hover:underline">
            View all clients →
          </Link>
        </p>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────
          4. Recent intakes — only renders when there's something to
             show. No more empty card with a stray loading sliver.
          ────────────────────────────────────────────────────────── */}
      {recentSubmissions.length > 0 ? (
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
          <ul className="divide-y divide-border">
            {recentSubmissions.map((s) => {
              const isHot = !s.reviewedAt && !s.convertedAt;
              const initial = (s.companyName ?? "?").slice(0, 1).toUpperCase();
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/intakes/${s.id}`}
                    className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-[2px] hover:bg-muted/20 transition-colors"
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
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] text-primary bg-primary/10">
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
        </SectionCard>
      ) : (
        <p className="text-xs text-muted-foreground px-1">
          No intake submissions yet ·{" "}
          <Link href="/admin/intakes" className="font-medium text-primary hover:underline">
            Share your intake form →
          </Link>
        </p>
      )}
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
    <div className="ls-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-[2px]",
            tone === "warn"
              ? "bg-[rgba(241,194,27,0.14)] text-[#8a6d00]"
              : tone === "positive"
                ? "bg-[rgba(36,161,72,0.10)] text-[#24a148]"
                : "bg-primary/10 text-primary",
          )}
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

// Compact operational counter used in the attention-queue header. Replaces
// the old standalone "Operations" panel (3 floating rows, one of which
// duplicated the leaderboard's lead count).
function OpsChip({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hair)] px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-[var(--hair-strong)] hover:text-foreground transition-colors whitespace-nowrap"
    >
      <span
        className={cn(
          "tabular-nums font-semibold",
          count > 0 ? "text-foreground" : "text-muted-foreground/50",
        )}
      >
        {count}
      </span>
      {label}
    </Link>
  );
}

const SEVERITY_GROUP_LABEL: Record<AdminActionSeverity, { label: string; color: string }> = {
  critical: { label: "Critical", color: "var(--error)" },
  warning: { label: "Warning", color: "#8a6d00" },
  info: { label: "Info", color: "var(--terracotta)" },
};

function ActionGroup({
  severity,
  items,
}: {
  severity: AdminActionSeverity;
  items: AdminActionItem[];
}) {
  if (items.length === 0) return null;
  const spec = SEVERITY_GROUP_LABEL[severity];
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1 pt-3 pb-1.5 first:pt-0">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: spec.color }}
        >
          {spec.label}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          · {items.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

// Age → color escalation: fresh flags stay quiet, but a critical or warning
// row that's sat for weeks should visually shout louder than one from this
// morning. Reuses the kit's own warning (#8a6d00 text on --warning wash)
// and error (--error) tokens — no ad-hoc amber Tailwind classes.
function ageBucket(occurredAt?: string): "fresh" | "aging" | "stale" {
  if (!occurredAt) return "fresh";
  const days = (Date.now() - new Date(occurredAt).getTime()) / DAY;
  if (days > 30) return "stale";
  if (days >= 7) return "aging";
  return "fresh";
}

const AGE_COLOR: Record<ReturnType<typeof ageBucket>, string> = {
  fresh: "var(--olive-gray)",
  aging: "#8a6d00",
  stale: "var(--error)",
};

function ActionRow({ item }: { item: AdminActionItem }) {
  const age = ageBucket(item.occurredAt);
  const verb = item.severity === "info" ? "View" : "Fix";
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 py-3 px-1 -mx-1 rounded-[2px] hover:bg-muted/30 transition-colors group"
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
        <div className="flex items-center gap-3 shrink-0">
          {item.occurredAt ? (
            <span
              className="text-[10px] font-medium tabular-nums whitespace-nowrap"
              style={{ color: AGE_COLOR[age] }}
            >
              {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}
            </span>
          ) : null}
          <span className="ls-btn ls-btn-secondary h-7 px-2.5 text-[11px] gap-1">
            {verb}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}

function SeverityIcon({ severity }: { severity: AdminActionSeverity }) {
  if (severity === "critical") {
    return (
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[2px] bg-destructive/10 text-destructive shrink-0">
        <AlertOctagon className="h-3.5 w-3.5" aria-label="Critical" />
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span
        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[2px] shrink-0"
        style={{ background: "rgba(241,194,27,0.14)", color: "#8a6d00" }}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-label="Warning" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[2px] bg-primary/10 text-primary shrink-0">
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
      ? "text-[#24a148]"
      : row.velocityDelta < 0
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <li>
      <Link
        href={`/admin/clients/${row.orgId}`}
        className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-[2px] hover:bg-muted/30 transition-colors"
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

function OnboardingRow({ row }: { row: TenantOnboardingRow }) {
  const days = Math.floor((Date.now() - new Date(row.updatedAt).getTime()) / DAY);
  return (
    <li>
      <Link
        href={`/admin/clients/${row.orgId}`}
        className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-[2px] hover:bg-muted/30 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {row.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {row.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge tone={tenantStatusTone(row.status)}>
            {humanTenantStatus(row.status)}
          </StatusBadge>
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            {days <= 0 ? "today" : `${days}d in stage`}
          </span>
        </div>
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
