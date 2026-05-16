/**
 * Admin-level insights — aggregations and action items that span the
 * entire agency (every client org). Powers the /admin dashboard,
 * pipeline, and client-detail "Needs attention" panel.
 *
 * Everything in here is read-only and tenant-scoped to OrgType.CLIENT.
 * Each helper is wrapped at the call site with .catch so a missing
 * integration row or schema drift doesn't blank the agency surface.
 */
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Money — agency-wide revenue health
// ---------------------------------------------------------------------------

export type AgencyMoney = {
  totalMrrCents: number;
  activeMrrCents: number;
  atRiskMrrCents: number;
  pausedMrrCents: number;
  activeCount: number;
  atRiskCount: number;
  pausedCount: number;
  /** New tenants launched in the last 30d (a soft "growth" signal). */
  launched30d: number;
  /** Tenants that churned in the last 30d (a "shrink" signal). */
  churned30d: number;
};

export async function getAgencyMoney(): Promise<AgencyMoney> {
  const since30d = new Date(Date.now() - 30 * DAY);

  const [grouped, launched30d, churned30d] = await Promise.all([
    prisma.organization.groupBy({
      by: ["status"],
      where: { orgType: OrgType.CLIENT },
      _sum: { mrrCents: true },
      _count: { _all: true },
    }),
    prisma.organization.count({
      where: {
        orgType: OrgType.CLIENT,
        launchedAt: { gte: since30d },
      },
    }),
    prisma.organization.count({
      where: {
        orgType: OrgType.CLIENT,
        status: TenantStatus.CHURNED,
        updatedAt: { gte: since30d },
      },
    }),
  ]);

  const byStatus = new Map<TenantStatus, { mrr: number; count: number }>();
  for (const row of grouped) {
    byStatus.set(row.status, {
      mrr: row._sum.mrrCents ?? 0,
      count: row._count._all,
    });
  }

  const get = (s: TenantStatus) => byStatus.get(s) ?? { mrr: 0, count: 0 };
  const active = get(TenantStatus.ACTIVE);
  const launched = get(TenantStatus.LAUNCHED);
  const atRisk = get(TenantStatus.AT_RISK);
  const paused = get(TenantStatus.PAUSED);

  return {
    totalMrrCents: active.mrr + launched.mrr + atRisk.mrr,
    activeMrrCents: active.mrr + launched.mrr,
    atRiskMrrCents: atRisk.mrr,
    pausedMrrCents: paused.mrr,
    activeCount: active.count + launched.count,
    atRiskCount: atRisk.count,
    pausedCount: paused.count,
    launched30d,
    churned30d,
  };
}

// ---------------------------------------------------------------------------
// Action items — ranked list of "what needs you today" across all tenants
// ---------------------------------------------------------------------------

export type AdminActionSeverity = "critical" | "warning" | "info";

export type AdminActionItem = {
  id: string;
  severity: AdminActionSeverity;
  title: string;
  detail: string;
  href: string;
  /** Optional tenant name for the inline tag. */
  tenantName?: string;
  /** Optional ISO timestamp for "X days ago" rendering. */
  occurredAt?: string;
};

const STALE_INTAKE_DAYS = 2;
const STALE_BUILD_DAYS = 14;
const STALE_SIGNED_DAYS = 7;
const STALE_APPFOLIO_DAYS = 3;

/**
 * Collect a single ranked list of admin action items by walking the
 * tenants table once and joining against integration state. Returns up
 * to `limit` items ordered by severity (critical → warning → info) and
 * then by recency.
 *
 * The detectors deliberately surface CONCRETE actions ("SG Real Estate:
 * AppFolio sync returned 404 16 days ago — fix") rather than abstract
 * counts ("3 at-risk clients") — the former is something the admin can
 * actually do in the next 5 minutes.
 */
export async function getAdminActionItems(
  limit = 12,
): Promise<AdminActionItem[]> {
  const now = Date.now();

  const clients = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    include: {
      domains: { select: { id: true, hostname: true, sslStatus: true, dnsConfigured: true } },
      appfolioIntegration: {
        select: {
          lastSyncAt: true,
          syncStatus: true,
          lastError: true,
          instanceSubdomain: true,
        },
      },
      cursiveIntegrations: {
        select: {
          cursivePixelId: true,
          lastEventAt: true,
          totalEventsCount: true,
          propertyId: true,
        },
      },
      tenantSiteConfig: { select: { enablePixel: true, chatbotEnabled: true } },
      _count: { select: { properties: true, users: true } },
    },
  });

  // Stale intake submissions (org-less rows waiting on agency review).
  const staleIntakes = await prisma.intakeSubmission.findMany({
    where: {
      reviewedAt: null,
      convertedAt: null,
      submittedAt: { lte: new Date(now - STALE_INTAKE_DAYS * DAY) },
    },
    orderBy: { submittedAt: "asc" },
    take: 6,
  });

  const items: AdminActionItem[] = [];

  for (const intake of staleIntakes) {
    const days = Math.floor(
      (now - intake.submittedAt.getTime()) / DAY,
    );
    items.push({
      id: `intake-stale-${intake.id}`,
      severity: days >= 7 ? "critical" : "warning",
      title: `Intake from ${intake.companyName} sat ${days}d unreviewed`,
      detail:
        intake.primaryContactEmail ??
        intake.propertyType ??
        "Decide: convert to client, request more info, or archive.",
      href: `/admin/intakes/${intake.id}`,
      tenantName: intake.companyName,
      occurredAt: intake.submittedAt.toISOString(),
    });
  }

  for (const o of clients) {
    // ─── At-risk flag (operator-marked) ───────────────────────────────
    if (o.status === TenantStatus.AT_RISK) {
      items.push({
        id: `at-risk-${o.id}`,
        severity: "critical",
        title: `${o.name} flagged at-risk`,
        detail: o.atRiskReason ?? "No reason recorded — open the client to review.",
        href: `/admin/clients/${o.id}`,
        tenantName: o.name,
        occurredAt: o.updatedAt.toISOString(),
      });
    }

    // ─── AppFolio sync errors / staleness ─────────────────────────────
    const af = o.appfolioIntegration;
    if (af) {
      if (af.lastError) {
        items.push({
          id: `appfolio-error-${o.id}`,
          severity: "critical",
          title: `${o.name}: AppFolio sync failing`,
          detail: af.lastError.slice(0, 140),
          href: `/admin/clients/${o.id}`,
          tenantName: o.name,
          occurredAt: af.lastSyncAt?.toISOString(),
        });
      } else if (
        af.lastSyncAt &&
        now - af.lastSyncAt.getTime() > STALE_APPFOLIO_DAYS * DAY
      ) {
        const days = Math.floor((now - af.lastSyncAt.getTime()) / DAY);
        items.push({
          id: `appfolio-stale-${o.id}`,
          severity: days >= 14 ? "critical" : "warning",
          title: `${o.name}: AppFolio last synced ${days}d ago`,
          detail: `Subdomain ${af.instanceSubdomain}. Sync should run hourly — check credentials.`,
          href: `/admin/clients/${o.id}`,
          tenantName: o.name,
          occurredAt: af.lastSyncAt.toISOString(),
        });
      }
    }

    // ─── Build stuck in progress ──────────────────────────────────────
    if (
      o.status === TenantStatus.BUILD_IN_PROGRESS &&
      now - o.updatedAt.getTime() > STALE_BUILD_DAYS * DAY
    ) {
      const days = Math.floor((now - o.updatedAt.getTime()) / DAY);
      items.push({
        id: `build-stuck-${o.id}`,
        severity: "warning",
        title: `${o.name}: Build in progress ${days}d`,
        detail: "Move to QA, mark blocked, or write a status note.",
        href: `/admin/clients/${o.id}`,
        tenantName: o.name,
        occurredAt: o.updatedAt.toISOString(),
      });
    }

    // ─── Contract signed without build start ─────────────────────────
    if (
      o.status === TenantStatus.CONTRACT_SIGNED &&
      now - o.updatedAt.getTime() > STALE_SIGNED_DAYS * DAY
    ) {
      const days = Math.floor((now - o.updatedAt.getTime()) / DAY);
      items.push({
        id: `signed-stale-${o.id}`,
        severity: "warning",
        title: `${o.name}: Signed ${days}d ago — build not started`,
        detail: "Kick off the build or update status if waiting on the client.",
        href: `/admin/clients/${o.id}`,
        tenantName: o.name,
        occurredAt: o.updatedAt.toISOString(),
      });
    }

    // ─── Pixel provisioned but never fired ────────────────────────────
    const primaryPixel =
      o.cursiveIntegrations.find((c) => c.propertyId === null) ?? null;
    if (
      o.modulePixel &&
      primaryPixel?.cursivePixelId &&
      (!primaryPixel.totalEventsCount || primaryPixel.totalEventsCount === 0)
    ) {
      items.push({
        id: `pixel-silent-${o.id}`,
        severity: "warning",
        title: `${o.name}: Cursive pixel provisioned but no events`,
        detail: "Pixel may not be installed. Verify install on the live domain.",
        href: `/admin/clients/${o.id}`,
        tenantName: o.name,
      });
    }

    // ─── Unverified domain / SSL pending ─────────────────────────────
    for (const d of o.domains) {
      if (!d.dnsConfigured) {
        items.push({
          id: `dns-${d.id}`,
          severity: "warning",
          title: `${o.name}: ${d.hostname} DNS not configured`,
          detail: "Tenant won't load on this hostname until DNS resolves.",
          href: `/admin/clients/${o.id}`,
          tenantName: o.name,
        });
      } else if (d.sslStatus && d.sslStatus !== "active") {
        items.push({
          id: `ssl-${d.id}`,
          severity: "warning",
          title: `${o.name}: SSL ${d.sslStatus} on ${d.hostname}`,
          detail: "Re-run cert provisioning if stuck >24h.",
          href: `/admin/clients/${o.id}`,
          tenantName: o.name,
        });
      }
    }

    // ─── Active tenant with zero properties ──────────────────────────
    if (
      (o.status === TenantStatus.ACTIVE || o.status === TenantStatus.LAUNCHED) &&
      o._count.properties === 0
    ) {
      items.push({
        id: `no-props-${o.id}`,
        severity: "warning",
        title: `${o.name}: Live tenant with no properties`,
        detail: "Add at least one property — the portal is unusable without one.",
        href: `/admin/clients/${o.id}`,
        tenantName: o.name,
      });
    }
  }

  // Sort: severity rank → recency
  const rank: Record<AdminActionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  items.sort((a, b) => {
    if (rank[a.severity] !== rank[b.severity]) {
      return rank[a.severity] - rank[b.severity];
    }
    return (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "");
  });

  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Tenant leaderboard — leads / visitors / activity over the last 7d
// ---------------------------------------------------------------------------

export type TenantLeaderRow = {
  orgId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  mrrCents: number;
  leads7d: number;
  leads28d: number;
  /** delta = (7d * 4) - 28d ; positive = accelerating */
  velocityDelta: number;
};

export async function getTenantLeaderboard(
  limit = 8,
): Promise<TenantLeaderRow[]> {
  const since28 = new Date(Date.now() - 28 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);

  const clients = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      mrrCents: true,
    },
  });
  if (clients.length === 0) return [];

  const ids = clients.map((c) => c.id);

  const [leads28, leads7] = await Promise.all([
    prisma.lead.groupBy({
      by: ["orgId"],
      where: { orgId: { in: ids }, createdAt: { gte: since28 } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["orgId"],
      where: { orgId: { in: ids }, createdAt: { gte: since7 } },
      _count: { _all: true },
    }),
  ]);

  const l28 = new Map(leads28.map((r) => [r.orgId, r._count._all]));
  const l7 = new Map(leads7.map((r) => [r.orgId, r._count._all]));

  const rows = clients
    .map((c) => {
      const v7 = l7.get(c.id) ?? 0;
      const v28 = l28.get(c.id) ?? 0;
      return {
        orgId: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        mrrCents: c.mrrCents ?? 0,
        leads7d: v7,
        leads28d: v28,
        velocityDelta: v7 * 4 - v28,
      };
    })
    .sort((a, b) => b.leads7d - a.leads7d || b.leads28d - a.leads28d);

  return rows.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Per-client action items — same detectors, scoped to one org. Powers the
// "Needs attention" panel on /admin/clients/[id].
// ---------------------------------------------------------------------------

export async function getClientActionItems(
  orgId: string,
): Promise<AdminActionItem[]> {
  const all = await getAdminActionItems(500);
  return all.filter((i) => i.href === `/admin/clients/${orgId}`);
}
