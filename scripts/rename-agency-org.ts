/**
 * rename-agency-org.ts — one-shot rename of the singleton AGENCY org so its
 * display name matches LeaseStack branding. Some early-bootstrap envs ended
 * up with "RealEstaite Agency" / "realestaite-agency" and that string was
 * surfacing in admin headers and any place we render org.name.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/rename-agency-org.ts
 *
 * Safe to run repeatedly. Reads AGENCY_ORG_SLUG from the env; renames slug
 * to that value if mismatched.
 */

import "dotenv/config";
import { PrismaClient, OrgType } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({
    adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
  });

  const targetName = "LeaseStack Agency";
  const targetSlug = process.env.AGENCY_ORG_SLUG ?? "leasestack-agency";
  const targetEmail =
    process.env.AGENCY_ADMIN_EMAIL ?? "adam@leasestack.co";

  const agency = await prisma.organization.findFirst({
    where: { orgType: OrgType.AGENCY },
    select: { id: true, name: true, slug: true, primaryContactEmail: true },
  });
  if (!agency) throw new Error("No AGENCY org found in DB.");

  // Skip slug change if another org already owns the target slug.
  let slugCanRename = agency.slug === targetSlug;
  if (!slugCanRename) {
    const conflict = await prisma.organization.findUnique({
      where: { slug: targetSlug },
      select: { id: true },
    });
    slugCanRename = !conflict;
  }

  const updated = await prisma.organization.update({
    where: { id: agency.id },
    data: {
      name: targetName,
      ...(slugCanRename ? { slug: targetSlug } : {}),
      primaryContactEmail: targetEmail,
      primaryContactName: "Adam Wolfe",
    },
  });

  console.log(
    `\nOK renamed AGENCY org:\n` +
      `  was:  ${agency.name} (${agency.slug})\n` +
      `  now:  ${updated.name} (${updated.slug})\n` +
      `  contact: ${updated.primaryContactEmail}\n` +
      (slugCanRename
        ? ""
        : `  WARN: slug not renamed (${targetSlug} already in use). Update AGENCY_ORG_SLUG to '${updated.slug}' or resolve the conflict manually.\n`)
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("rename-agency-org failed:", err);
  process.exit(1);
});
