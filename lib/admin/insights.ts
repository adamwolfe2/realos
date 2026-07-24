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
// Internal-workspace heuristic — DISPLAY FILTER ONLY. Never deletes, never
// excludes anything from the money/action-item math — it only decides what
// shows up in tenant-facing lists (leaderboard, onboarding, attention queue).
//
// The agency's own team spins up CLIENT-type orgs while building/demoing:
// Adam's personal test workspace, an un-renamed Clerk default ("x@y.com's
// workspace") from someone poking the signup flow, seeded demo fixtures.
// None of those are real prospects, but with them mixed in the tenant lists
// were 5 rows of zeros. An org is treated as internal when ANY of:
//   1. Its contact-email domain is one of the agency's own companies, the
//      platform's own domain (demo/staging tenants), or the RFC 2606
//      placeholder domain seed scripts use (example.com).
//   2. Its name is an un-renamed Clerk default ("someone@x.com's workspace").
//   3. Its name or slug contains "demo"/"test" as a whole word.
// ---------------------------------------------------------------------------
const KNOWN_INTERNAL_EMAIL_DOMAINS = new Set([
  "leasestack.co", // the platform's own domain — demo/staging tenants
  "amcollectivecapital.com", // Adam's other company, used as a test org
  "modern-amenities.com", // Adam's other company
  "mentor126.ai", // Adam's other company
  "example.com", // RFC 2606 placeholder — seeded/dummy fixtures
]);
const WORKSPACE_DEFAULT_NAME_RE = /'s workspace$/i;
const DEMO_OR_TEST_NAME_RE = /\b(demo|test)\b/i;

export function isInternalWorkspaceOrg(org: {
  name: string;
  slug: string;
  primaryContactEmail?: string | null;
}): boolean {
  const domain = org.primaryContactEmail?.split("@")[1]?.toLowerCase();
  if (domain && KNOWN_INTERNAL_EMAIL_DOMAINS.has(domain)) return true;
  if (WORKSPACE_DEFAULT_NAME_RE.test(org.name)) return true;
  if (DEMO_OR_TEST_NAME_RE.test(org.name) || DEMO_OR_TEST_NAME_RE.test(org.slug)) {
    return true;
  }
  return false;
}

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
  /** BUILD_IN_PROGRESS + CONTRACT_SIGNED + QA, same set the page header
   *  adds to activeCount/atRiskCount/pausedCount for "N tenants live". */
  onboardingCount: number;
  /** New tenants launched in the last 30d (a soft "growth" signal). */
  launched30d: number;
  /** Tenants that churned in the last 30d (a "shrink" signal). */
  churned30d: number;
};

/**
 * Every KPI on the agency-overview page must come from the same filtered
 * tenant set as the lists below (active/onboarding/attention queue) — see
 * isInternalWorkspaceOrg. Previously this ran a DB-side groupBy over ALL
 * CLIENT orgs, so an un-renamed Clerk workspace or demo fixture could show
 * up as "1 client flagged at-risk" in the KPI strip while the attention
 * queue (which does filter) reported all-clear. Aggregating in JS over the
 * same filtered rows the other helpers use keeps the whole page honest.
 */
export async function getAgencyMoney(): Promise<AgencyMoney> {
  const since30d = new Date(Date.now() - 30 * DAY);

  const allClients = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    select: {
      name: true,
      slug: true,
      primaryContactEmail: true,
      status: true,
      mrrCents: true,
      launchedAt: true,
      updatedAt: true,
    },
  });

  const clients = allClients.filter((o) => !isInternalWorkspaceOrg(o));

  const byStatus = new Map<TenantStatus, { mrr: number; count: number }>();
  for (const c of clients) {
    const bucket = byStatus.get(c.status) ?? { mrr: 0, count: 0 };
    bucket.mrr += c.mrrCents ?? 0;
    bucket.count += 1;
    byStatus.set(c.status, bucket);
  }

  const get = (s: TenantStatus) => byStatus.get(s) ?? { mrr: 0, count: 0 };
  const active = get(TenantStatus.ACTIVE);
  const launched = get(TenantStatus.LAUNCHED);
  const atRisk = get(TenantStatus.AT_RISK);
  const paused = get(TenantStatus.PAUSED);
  const buildInProgress = get(TenantStatus.BUILD_IN_PROGRESS);
  const contractSigned = get(TenantStatus.CONTRACT_SIGNED);
  const qa = get(TenantStatus.QA);

  const launched30d = clients.filter(
    (c) => c.launchedAt && c.launchedAt.getTime() >= since30d.getTime(),
  ).length;
  const churned30d = clients.filter(
    (c) =>
      c.status === TenantStatus.CHURNED &&
      c.updatedAt.getTime() >= since30d.getTime(),
  ).length;

  return {
    totalMrrCents: active.mrr + launched.mrr + atRisk.mrr,
    activeMrrCents: active.mrr + launched.mrr,
    atRiskMrrCents: atRisk.mrr,
    pausedMrrCents: paused.mrr,
    activeCount: active.count + launched.count,
    atRiskCount: atRisk.count,
    pausedCount: paused.count,
    onboardingCount: buildInProgress.count + contractSigned.count + qa.count,
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

  const allClients = await prisma.organization.findMany({
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

  // Internal/test workspaces don't need "AppFolio sync failing" or
  // "flagged at-risk" surfaced to the operator — same display filter as
  // the tenant lists (see isInternalWorkspaceOrg above).
  const clients = allClients.filter((o) => !isInternalWorkspaceOrg(o));

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
// Tenant segments — replaces the old single "leaderboard" (which mixed live
// tenants and pre-launch pipeline rows into one list, so anything not yet
// launched showed up as 5 columns of zero). Split into:
//   - active:     launched/live tenants, ranked by lead velocity + trend
//   - onboarding: pre-launch pipeline tenants, shown by stage only — no
//                 lead-velocity columns, because they have no live pixel
//                 generating leads yet and a "0" column there is noise.
// Both lists exclude internal/test workspaces (see isInternalWorkspaceOrg).
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

export type TenantOnboardingRow = {
  orgId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  /** ISO timestamp of the last status change — powers "in stage Nd". */
  updatedAt: string;
};

export type TenantSegments = {
  active: TenantLeaderRow[];
  onboarding: TenantOnboardingRow[];
  /** Internal/test CLIENT-type orgs hidden from both lists above. */
  internalHiddenCount: number;
};

const ACTIVE_TENANT_STATUSES = new Set<TenantStatus>([
  TenantStatus.ACTIVE,
  TenantStatus.LAUNCHED,
  TenantStatus.AT_RISK,
  TenantStatus.PAUSED,
]);
const ONBOARDING_TENANT_STATUSES = new Set<TenantStatus>([
  TenantStatus.INTAKE_RECEIVED,
  TenantStatus.CONSULTATION_BOOKED,
  TenantStatus.PROPOSAL_SENT,
  TenantStatus.CONTRACT_SIGNED,
  TenantStatus.BUILD_IN_PROGRESS,
  TenantStatus.QA,
]);

export async function getTenantSegments(limit = 8): Promise<TenantSegments> {
  const since28 = new Date(Date.now() - 28 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);

  const allClients = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      mrrCents: true,
      primaryContactEmail: true,
      updatedAt: true,
    },
  });

  const internalHiddenCount = allClients.filter(isInternalWorkspaceOrg).length;
  const clients = allClients.filter((c) => !isInternalWorkspaceOrg(c));

  const activeClients = clients.filter((c) => ACTIVE_TENANT_STATUSES.has(c.status));
  const onboardingClients = clients.filter((c) =>
    ONBOARDING_TENANT_STATUSES.has(c.status),
  );

  const activeIds = activeClients.map((c) => c.id);
  const [leads28, leads7] = activeIds.length
    ? await Promise.all([
        prisma.lead.groupBy({
          by: ["orgId"],
          where: { orgId: { in: activeIds }, createdAt: { gte: since28 } },
          _count: { _all: true },
        }),
        prisma.lead.groupBy({
          by: ["orgId"],
          where: { orgId: { in: activeIds }, createdAt: { gte: since7 } },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const l28 = new Map(leads28.map((r) => [r.orgId, r._count._all]));
  const l7 = new Map(leads7.map((r) => [r.orgId, r._count._all]));

  const active = activeClients
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
    .sort((a, b) => b.leads7d - a.leads7d || b.leads28d - a.leads28d)
    .slice(0, limit);

  const onboarding = onboardingClients
    .map((c) => ({
      orgId: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      updatedAt: c.updatedAt.toISOString(),
    }))
    // Oldest-in-stage first — the one that's been sitting longest is the
    // one most likely to need a nudge.
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, limit);

  return { active, onboarding, internalHiddenCount };
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
