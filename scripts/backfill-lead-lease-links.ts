// Backfill Resident.leadId + Lead SIGNED promotion for historical rows.
//
// Why: lease↔lead matching was exact-case email only, so the live tenant's
// historical residents/leases never linked to the leads that produced them
// ("all zeros downstream" in our own dashboard — deep-audit P0, 2026-07-22).
// The live sync path is fixed (case-insensitive match in appfolio-sync.ts),
// but existing rows need a one-time backfill.
//
// Matching, in strictness order (per resident with leadId = null):
//   1. email  — case-insensitive exact
//   2. phone  — last-10-digit match (only when unambiguous: exactly 1 lead)
// No name-based fuzzy matching: false links are worse than missing links.
//
// SAFE BY DEFAULT: dry-run. Prints per-org match counts + a sample.
//   npx tsx scripts/backfill-lead-lease-links.ts               # dry-run, all orgs
//   npx tsx scripts/backfill-lead-lease-links.ts --org <slug>  # dry-run, one org
//   npx tsx scripts/backfill-lead-lease-links.ts --org <slug> --apply
//
// --apply writes: Resident.leadId, plus a monotonic Lead promotion to SIGNED
// (updateMany over lower-ranked statuses only — never demotes, mirrors the
// sync-path rule).

import { LeadStatus } from "@prisma/client";
import { getPrisma } from "../lib/db";

// Prisma 7 + Neon adapter: bare `new PrismaClient()` no longer works —
// route through the canonical adapter-backed client.
const prisma = getPrisma();

const APPLY = process.argv.includes("--apply");
const orgFlag = process.argv.indexOf("--org");
const ORG_SLUG = orgFlag > -1 ? process.argv[orgFlag + 1] : null;

const LOWER_THAN_SIGNED: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOURED",
  "APPLICATION_SENT",
  "APPLIED",
  "APPROVED",
] as LeadStatus[];

function phoneKey(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.slice(-10);
}

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      orgType: "CLIENT",
      ...(ORG_SLUG ? { slug: ORG_SLUG } : {}),
    },
    select: { id: true, name: true, slug: true },
  });
  if (orgs.length === 0) {
    console.log(`No orgs matched${ORG_SLUG ? ` slug "${ORG_SLUG}"` : ""}.`);
    return;
  }
  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"} — ${orgs.length} org(s)${ORG_SLUG ? ` (${ORG_SLUG})` : ""}\n`,
  );

  for (const org of orgs) {
    const [leads, residents] = await Promise.all([
      prisma.lead.findMany({
        where: { orgId: org.id },
        select: { id: true, email: true, phone: true, status: true },
      }),
      prisma.resident.findMany({
        where: { property: { orgId: org.id }, leadId: null },
        select: { id: true, email: true, phone: true },
      }),
    ]);

    // Index leads once per org — no per-resident queries.
    const byEmail = new Map<string, { id: string; status: LeadStatus }[]>();
    const byPhone = new Map<string, { id: string; status: LeadStatus }[]>();
    for (const l of leads) {
      if (l.email) {
        const k = l.email.trim().toLowerCase();
        byEmail.set(k, [...(byEmail.get(k) ?? []), l]);
      }
      const pk = phoneKey(l.phone);
      if (pk) byPhone.set(pk, [...(byPhone.get(pk) ?? []), l]);
    }

    let emailHits = 0;
    let phoneHits = 0;
    let ambiguous = 0;
    const sample: string[] = [];
    const links: { residentId: string; leadId: string }[] = [];

    for (const r of residents) {
      let match: { id: string; status: LeadStatus } | null = null;
      let via = "";

      if (r.email) {
        const c = byEmail.get(r.email.trim().toLowerCase()) ?? [];
        if (c.length === 1) {
          match = c[0];
          via = "email";
          emailHits++;
        } else if (c.length > 1) {
          ambiguous++;
          continue;
        }
      }
      if (!match) {
        const pk = phoneKey(r.phone);
        if (pk) {
          const c = byPhone.get(pk) ?? [];
          if (c.length === 1) {
            match = c[0];
            via = "phone";
            phoneHits++;
          } else if (c.length > 1) {
            ambiguous++;
            continue;
          }
        }
      }
      if (!match) continue;

      links.push({ residentId: r.id, leadId: match.id });
      if (sample.length < 8)
        sample.push(`  resident ${r.id} -> lead ${match.id} (${via})`);
    }

    console.log(
      `${org.name} (${org.slug}): ${residents.length} unlinked residents, ${leads.length} leads → ` +
        `${links.length} matches (${emailHits} email, ${phoneHits} phone), ${ambiguous} ambiguous skipped`,
    );
    if (sample.length) console.log(sample.join("\n"));

    if (APPLY && links.length > 0) {
      let linked = 0;
      let promoted = 0;
      for (const { residentId, leadId } of links) {
        await prisma.resident.update({
          where: { id: residentId },
          data: { leadId },
        });
        linked++;
        const res = await prisma.lead.updateMany({
          where: { id: leadId, status: { in: LOWER_THAN_SIGNED } },
          data: {
            status: "SIGNED" as LeadStatus,
            convertedAt: new Date(),
            lastActivityAt: new Date(),
          },
        });
        promoted += res.count;
      }
      console.log(`  APPLIED: ${linked} residents linked, ${promoted} leads promoted to SIGNED\n`);
    } else {
      console.log("");
    }
  }
}

main()
  .catch((err) => {
    console.error("backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
