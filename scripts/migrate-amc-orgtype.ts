/**
 * migrate-amc-orgtype.ts — flip the AM Collective Organization row from
 * orgType=CLIENT to orgType=AGENCY.
 *
 * Why: AM Collective is the parent agency that operates LeaseStack itself.
 * It was bootstrapped (or re-seeded) as a CLIENT, which means agency-only
 * surfaces — /admin layout gating, impersonation, agency dashboards,
 * tenantWhere() bypass, requireAgency() — were mis-routing members of
 * the AM Collective org into the /portal experience instead of /admin.
 *
 * Behavior:
 *   1. Loads prisma client (Neon HTTP adapter, same pattern as
 *      scripts/rename-agency-org.ts).
 *   2. Finds the AM Collective org via case-insensitive name match
 *      ("AM Collective") OR slug = "am-collective".
 *   3. Safety check: aborts loudly if more than one matching row exists.
 *   4. Idempotent: if orgType is already AGENCY → logs "already migrated"
 *      and exits cleanly without writing.
 *   5. If not found: logs a warning and exits 0 (so CI re-runs don't fail
 *      if someone manually renamed/removed the row).
 *   6. On a real change: writes the new orgType AND records an AuditEvent
 *      row (action=UPDATE, entityType='Organization.orgType') with a diff
 *      containing { before, after } so the migration is traceable.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/migrate-amc-orgtype.ts
 *
 * Safe to run repeatedly. Does NOT modify any other row.
 *
 * Companion runbook: docs/AM_COLLECTIVE_ORGTYPE_MIGRATION.md
 */

import "dotenv/config";
import {
  PrismaClient,
  OrgType,
  AuditAction,
  Prisma,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

const TARGET_NAME_PATTERN = "AM Collective";
const TARGET_SLUG = "am-collective";

type CandidateOrg = {
  id: string;
  name: string;
  slug: string;
  orgType: OrgType;
};

async function findCandidates(prisma: PrismaClient): Promise<CandidateOrg[]> {
  // ILIKE on name OR exact slug match. We union the two queries in JS
  // instead of using a raw query so we stay on the type-safe Prisma API
  // (Prisma's `mode: 'insensitive'` is the supported portable form of
  // ILIKE on Postgres).
  const [byName, bySlug] = await Promise.all([
    prisma.organization.findMany({
      where: {
        name: { contains: TARGET_NAME_PATTERN, mode: "insensitive" },
      },
      select: { id: true, name: true, slug: true, orgType: true },
    }),
    prisma.organization.findMany({
      where: { slug: TARGET_SLUG },
      select: { id: true, name: true, slug: true, orgType: true },
    }),
  ]);

  // Deduplicate by id.
  const byId = new Map<string, CandidateOrg>();
  for (const row of [...byName, ...bySlug]) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
  });

  try {
    console.log(
      `[migrate-amc-orgtype] Searching for org matching name ILIKE '%${TARGET_NAME_PATTERN}%' OR slug = '${TARGET_SLUG}'...`
    );

    const candidates = await findCandidates(prisma);

    if (candidates.length === 0) {
      console.warn(
        "[migrate-amc-orgtype] WARN: no AM Collective organization found. " +
          "Nothing to do. Exiting cleanly."
      );
      return;
    }

    if (candidates.length > 1) {
      console.error(
        "[migrate-amc-orgtype] ABORT: found multiple candidate organizations. " +
          "Refusing to guess which one to migrate. Resolve manually before re-running."
      );
      for (const row of candidates) {
        console.error(
          `  - ${row.id}  name='${row.name}'  slug='${row.slug}'  orgType=${row.orgType}`
        );
      }
      process.exit(2);
    }

    const target = candidates[0];
    console.log(
      `[migrate-amc-orgtype] Found single candidate:\n` +
        `  id:      ${target.id}\n` +
        `  name:    ${target.name}\n` +
        `  slug:    ${target.slug}\n` +
        `  orgType: ${target.orgType}`
    );

    if (target.orgType === OrgType.AGENCY) {
      console.log(
        "[migrate-amc-orgtype] OK: orgType is already AGENCY. Already migrated. No-op."
      );
      return;
    }

    const before = target.orgType;
    const after = OrgType.AGENCY;

    // Update + audit row written atomically so we never end up with a
    // changed orgType and no audit record (or vice versa).
    const [updated, audit] = await prisma.$transaction([
      prisma.organization.update({
        where: { id: target.id },
        data: { orgType: after },
        select: { id: true, name: true, slug: true, orgType: true },
      }),
      prisma.auditEvent.create({
        data: {
          orgId: target.id,
          // userId is intentionally null — this is a script-driven backfill,
          // not an in-app action by a specific user. AuditEvent.userId is
          // already nullable in the schema (SetNull on user delete).
          userId: null,
          action: AuditAction.UPDATE,
          entityType: "Organization.orgType",
          entityId: target.id,
          description:
            "scripts/migrate-amc-orgtype.ts flipped AM Collective from CLIENT to AGENCY",
          diff: {
            field: "orgType",
            before,
            after,
            source: "scripts/migrate-amc-orgtype.ts",
            ranAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        select: { id: true, createdAt: true },
      }),
    ]);

    console.log(
      `[migrate-amc-orgtype] OK migrated:\n` +
        `  org:         ${updated.name} (${updated.slug})\n` +
        `  orgType:     ${before} -> ${updated.orgType}\n` +
        `  audit row:   ${audit.id} @ ${audit.createdAt.toISOString()}\n` +
        `  next steps:  members of this org should re-sign-in so /admin gating picks up the change.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[migrate-amc-orgtype] FAILED:", err);
  process.exit(1);
});
