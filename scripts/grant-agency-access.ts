/**
 * grant-agency-access.ts — promote (or create) a User row to AGENCY_OWNER /
 * AGENCY_ADMIN / AGENCY_OPERATOR on the singleton AGENCY org. Used to add
 * teammates or auditors to the LeaseStack agency cockpit without going
 * through the intake flow.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/grant-agency-access.ts \
 *     --email jsoc@uoregon.edu \
 *     --role AGENCY_OWNER \
 *     --first "James" --last "O'Connor"
 *
 * Idempotent. Re-running with the same email updates the existing row's
 * orgId / role / name fields. Safe to run against prod.
 */

import "dotenv/config";
import {
  PrismaClient,
  OrgType,
  UserRole,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const AGENCY_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

async function main() {
  const email = arg("--email")?.toLowerCase();
  const roleInput = (arg("--role") ?? "AGENCY_OWNER") as UserRole;
  const firstName = arg("--first") ?? null;
  const lastName = arg("--last") ?? null;

  if (!email) {
    throw new Error("--email is required (e.g. --email jsoc@uoregon.edu)");
  }
  if (!AGENCY_ROLES.has(roleInput)) {
    throw new Error(
      `--role must be one of AGENCY_OWNER, AGENCY_ADMIN, AGENCY_OPERATOR (got ${roleInput})`
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({
    adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
  });

  const agency = await prisma.organization.findFirst({
    where: { orgType: OrgType.AGENCY },
    select: { id: true, name: true, slug: true },
  });
  if (!agency) {
    throw new Error(
      "No AGENCY organization found in the database. Run the seed script or create one first."
    );
  }

  const pendingId = `seed_pending_${email}`;
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          orgId: agency.id,
          role: roleInput,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
        },
      })
    : await prisma.user.create({
        data: {
          clerkUserId: pendingId,
          email,
          firstName,
          lastName,
          role: roleInput,
          orgId: agency.id,
        },
      });

  console.log(
    `\nOK ${existing ? "updated" : "created"} agency User row:\n` +
      `  email:     ${user.email}\n` +
      `  role:      ${user.role}\n` +
      `  org:       ${agency.name} (${agency.slug})\n` +
      `  userId:    ${user.id}\n` +
      `  clerkId:   ${user.clerkUserId}\n\n` +
      `Next step for ${user.email}:\n` +
      `  1. Sign in at ${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app-url"}/sign-in\n` +
      `  2. /api/auth/role claims this row by email and links the Clerk user id.\n` +
      `  3. They land in /admin with full agency access (all tenants, impersonation, etc).\n`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("grant-agency-access failed:", err);
  process.exit(1);
});
