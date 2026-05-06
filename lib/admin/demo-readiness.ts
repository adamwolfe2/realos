import "server-only";
import { prisma } from "@/lib/db";
import { OrgType, ResidentStatus, LeaseStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-tenant demo readiness — the checklist agency staff scan before walking
// a prospect through the portal. Catches the embarrassing "open the demo
// and discover the pixel went silent yesterday" failure mode before the
// call starts.
//
// Each check returns a state and a short hint. States map to traffic-light
// colors in the UI:
//   pass  — green, ready to demo
//   warn  — amber, demo possible but explain
//   fail  — red, fix before going live
//   skip  — grey, not relevant for this tenant config
// ---------------------------------------------------------------------------

export type CheckState = "pass" | "warn" | "fail" | "skip";

export type ReadinessCheck = {
  id: string;
  label: string;
  state: CheckState;
  hint: string;
};

export type TenantReadiness = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  checks: ReadinessCheck[];
  passCount: number;
  warnCount: number;
  failCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getReadinessForAllTenants(): Promise<TenantReadiness[]> {
  const orgs = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    orgs.map((o) => getReadinessForTenant(o.id, o.name, o.slug))
  );
  return results;
}

export async function getReadinessForTenant(
  orgId: string,
  orgName: string,
  orgSlug: string
): Promise<TenantReadiness> {
  const [
    appfolio,
    cursive,
    propertiesCount,
    leadsCount,
    activeResidentsCount,
    expiringLeasesCount,
    openWorkOrdersCount,
    membersCount,
    pixelEventsCount,
    reputationMentionsCount,
    teamUsersCount,
  ] = await Promise.all([
    prisma.appFolioIntegration
      .findUnique({
        where: { orgId },
        select: {
          instanceSubdomain: true,
          clientIdEncrypted: true,
          apiKeyEncrypted: true,
          useEmbedFallback: true,
          syncStatus: true,
          lastSyncAt: true,
          lastError: true,
        },
      })
      .catch(() => null),
    // Demo readiness considers the legacy org-wide row only — admin
    // demo flow predates per-property scoping. Multi-property orgs in
    // demo mode would still surface their org-level pixel here.
    prisma.cursiveIntegration
      .findFirst({
        where: { orgId, propertyId: null },
        select: {
          cursivePixelId: true,
          installedOnDomain: true,
          lastEventAt: true,
        },
      })
      .catch(() => null),
    prisma.property.count({ where: { orgId } }),
    prisma.lead.count({ where: { orgId } }),
    prisma.resident.count({
      where: { orgId, status: ResidentStatus.ACTIVE },
    }),
    prisma.lease.count({
      where: {
        orgId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 120 * DAY_MS),
        },
      },
    }),
    prisma.workOrder.count({
      where: {
        orgId,
        status: { not: "COMPLETED" },
      },
    }),
    prisma.user.count({ where: { orgId } }),
    prisma.visitor.count({
      where: { orgId, lastSeenAt: { gte: new Date(Date.now() - DAY_MS) } },
    }),
    prisma.propertyMention.count({ where: { orgId } }).catch(() => 0),
    prisma.user.count({
      where: { orgId },
    }),
  ]);

  const checks: ReadinessCheck[] = [];

  // Property baseline
  checks.push(
    propertiesCount > 0
      ? {
          id: "property",
          label: "At least one property",
          state: "pass",
          hint: `${propertiesCount} property${propertiesCount === 1 ? "" : "ies"} on file`,
        }
      : {
          id: "property",
          label: "At least one property",
          state: "fail",
          hint: "No properties yet — add one before demoing",
        }
  );

  // Leads baseline
  checks.push(
    leadsCount > 0
      ? {
          id: "leads",
          label: "At least one lead",
          state: "pass",
          hint: `${leadsCount.toLocaleString()} leads on file`,
        }
      : {
          id: "leads",
          label: "At least one lead",
          state: "warn",
          hint: "Empty pipeline — funnel and dashboard will look thin",
        }
  );

  // AppFolio
  const hasAfCreds =
    Boolean(appfolio?.instanceSubdomain) &&
    (Boolean(appfolio?.clientIdEncrypted) ||
      Boolean(appfolio?.apiKeyEncrypted) ||
      Boolean(appfolio?.useEmbedFallback));

  if (!appfolio) {
    checks.push({
      id: "appfolio-creds",
      label: "AppFolio credentials configured",
      state: "fail",
      hint: "No AppFolio integration row — operations pages stay empty",
    });
    checks.push({
      id: "appfolio-sync",
      label: "AppFolio sync ran successfully",
      state: "skip",
      hint: "Connect AppFolio first",
    });
  } else if (!hasAfCreds) {
    checks.push({
      id: "appfolio-creds",
      label: "AppFolio credentials configured",
      state: "fail",
      hint: "Integration row exists but has no usable credentials",
    });
    checks.push({
      id: "appfolio-sync",
      label: "AppFolio sync ran successfully",
      state: "skip",
      hint: "Add credentials first",
    });
  } else {
    checks.push({
      id: "appfolio-creds",
      label: "AppFolio credentials configured",
      state: "pass",
      hint: `Subdomain ${appfolio.instanceSubdomain}`,
    });
    if (appfolio.lastError) {
      checks.push({
        id: "appfolio-sync",
        label: "AppFolio sync ran successfully",
        state: "fail",
        hint: appfolio.lastError.slice(0, 140),
      });
    } else if (!appfolio.lastSyncAt) {
      checks.push({
        id: "appfolio-sync",
        label: "AppFolio sync ran successfully",
        state: "warn",
        hint: "Connected but first sync hasn't run",
      });
    } else {
      const ageMs = Date.now() - appfolio.lastSyncAt.getTime();
      checks.push(
        ageMs <= 24 * DAY_MS
          ? {
              id: "appfolio-sync",
              label: "AppFolio sync ran successfully",
              state: "pass",
              hint: `${activeResidentsCount} active residents · ${expiringLeasesCount} renewals · ${openWorkOrdersCount} open work orders`,
            }
          : {
              id: "appfolio-sync",
              label: "AppFolio sync ran successfully",
              state: "warn",
              hint: `Last sync was ${Math.round(ageMs / DAY_MS)} days ago — re-run before demo`,
            }
      );
    }
  }

  // Pixel
  if (!cursive?.cursivePixelId) {
    checks.push({
      id: "pixel",
      label: "Visitor pixel installed",
      state: "fail",
      hint: "No pixel id provisioned",
    });
    checks.push({
      id: "pixel-events",
      label: "Pixel firing in last 24h",
      state: "skip",
      hint: "Provision pixel first",
    });
  } else {
    checks.push({
      id: "pixel",
      label: "Visitor pixel installed",
      state: "pass",
      hint: cursive.installedOnDomain ?? "Snippet ready",
    });
    if (pixelEventsCount > 0) {
      checks.push({
        id: "pixel-events",
        label: "Pixel firing in last 24h",
        state: "pass",
        hint: `${pixelEventsCount} active visitors in last 24h`,
      });
    } else if (cursive.lastEventAt) {
      const ageMs = Date.now() - cursive.lastEventAt.getTime();
      const days = Math.round(ageMs / DAY_MS);
      checks.push({
        id: "pixel-events",
        label: "Pixel firing in last 24h",
        state: days > 7 ? "fail" : "warn",
        hint: `Last event ${days} day${days === 1 ? "" : "s"} ago`,
      });
    } else {
      checks.push({
        id: "pixel-events",
        label: "Pixel firing in last 24h",
        state: "fail",
        hint: "No events ever recorded",
      });
    }
  }

  // Reputation
  checks.push(
    reputationMentionsCount > 0
      ? {
          id: "reputation",
          label: "Reputation scanner has data",
          state: "pass",
          hint: `${reputationMentionsCount.toLocaleString()} mentions tracked`,
        }
      : {
          id: "reputation",
          label: "Reputation scanner has data",
          state: "warn",
          hint: "Run a scan from any property to seed the reputation page",
        }
  );

  // Email/Resend health is platform-wide — covered by admin/system Resend
  // check separately. We just confirm at least one team member exists so an
  // invite test can be sent.
  checks.push(
    teamUsersCount > 0
      ? {
          id: "team",
          label: "At least one team member",
          state: "pass",
          hint: `${teamUsersCount} ${teamUsersCount === 1 ? "user" : "users"} on this org`,
        }
      : {
          id: "team",
          label: "At least one team member",
          state: "fail",
          hint: "No users on the org — invite the demo viewer first",
        }
  );
  // membersCount isn't actually different from teamUsersCount; left here as a
  // single source so we don't double-count and the lint is happy.
  void membersCount;

  const passCount = checks.filter((c) => c.state === "pass").length;
  const warnCount = checks.filter((c) => c.state === "warn").length;
  const failCount = checks.filter((c) => c.state === "fail").length;

  return {
    orgId,
    orgName,
    orgSlug,
    checks,
    passCount,
    warnCount,
    failCount,
  };
}
