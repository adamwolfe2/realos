// Backfill Resident.leadId + Lead SIGNED promotion for historical rows.
//
// Why: lease↔lead matching was exact-case email only, so the live tenant's
// historical residents/leases never linked to the leads that produced them
// ("all zeros downstream" in our own dashboard — deep-audit P0, 2026-07-22).
// The live sync path is fixed (case-insensitive match in appfolio-sync.ts),
// but existing rows need a one-time backfill.
//
// Matching (shared with the live sync — lib/leads/lead-lease-link.ts),
// in strictness order per resident with leadId = null:
//   1. email — case-insensitive exact
//   2. phone — last-10-digit match
//   3. name  — exact normalized "first last" (both parts, 2+ chars)
// Every tier is unambiguous-only (exactly 1 lead) and ambiguity ABORTS the
// match. Still no fuzzy matching: false links are worse than missing links.
//
// SAFE BY DEFAULT: dry-run. Prints per-org match counts + a sample.
//   npx tsx scripts/backfill-lead-lease-links.ts               # dry-run, all orgs
//   npx tsx scripts/backfill-lead-lease-links.ts --org <slug>  # dry-run, one org
//   npx tsx scripts/backfill-lead-lease-links.ts --org <slug> --apply
//
// --apply writes: Resident.leadId, plus a monotonic Lead promotion to SIGNED
// (updateMany over lower-ranked statuses only — never demotes, mirrors the
// sync-path rule).

import type { LeadStatus } from "@prisma/client";
import { getPrisma } from "../lib/db";
import {
  buildLeadMatchIndex,
  matchResidentToLead,
  LEAD_STATUSES_BELOW_SIGNED,
} from "../lib/leads/lead-lease-link";

// Prisma 7 + Neon adapter: bare `new PrismaClient()` no longer works —
// route through the canonical adapter-backed client.
const prisma = getPrisma();

const APPLY = process.argv.includes("--apply");
const orgFlag = process.argv.indexOf("--org");
const ORG_SLUG = orgFlag > -1 ? process.argv[orgFlag + 1] : null;

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
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          // Corroborates the weak (phone/name) tiers — see
          // matchResidentToLead.
          propertyId: true,
        },
      }),
      prisma.resident.findMany({
        // Resident carries its own orgId — scope on it directly, the same
        // key the leads query uses. (Was `property: { orgId }`, a second
        // scoping path that would cross orgs if the two ever disagreed.)
        //
        // leadLinkManual: false — never re-link a resident an operator
        // explicitly unlinked. The sync honors this flag; without it here,
        // one `--apply` run would restore the exact wrong link they removed.
        where: { orgId: org.id, leadId: null, leadLinkManual: false },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          // Corroborates the weak (phone/name) tiers.
          propertyId: true,
          // Signing evidence for convertedAt — same anchor as the manual
          // link route.
          moveInDate: true,
          currentLease: { select: { startDate: true } },
        },
      }),
    ]);

    // Shared unambiguous email → phone → name ladder — the same rules the
    // live AppFolio sync applies (lib/leads/lead-lease-link.ts). Ambiguity
    // at any tier aborts that resident's match entirely.
    const index = buildLeadMatchIndex(leads);

    const hitsByVia: Record<string, number> = {};
    const sample: string[] = [];
    const links: {
      residentId: string;
      leadId: string;
      convertedAt: Date;
    }[] = [];

    for (const r of residents) {
      const match = matchResidentToLead(index, r);
      if (!match) continue;
      hitsByVia[match.via] = (hitsByVia[match.via] ?? 0) + 1;
      links.push({
        residentId: r.id,
        leadId: match.leadId,
        // Anchor to the real signing date. Stamping `new Date()` (the old
        // behavior) dumped years of historical signings into today's
        // reporting period — generate.ts buckets tracedSignedLeads by
        // convertedAt, so a single backfill run would have spiked the
        // current month with every past lease.
        convertedAt: r.currentLease?.startDate ?? r.moveInDate ?? new Date(),
      });
      if (sample.length < 8)
        sample.push(`  resident ${r.id} -> lead ${match.leadId} (${match.via})`);
    }

    const viaSummary =
      Object.entries(hitsByVia)
        .map(([via, n]) => `${n} ${via}`)
        .join(", ") || "none";
    console.log(
      `${org.name} (${org.slug}): ${residents.length} unlinked residents, ${leads.length} leads → ` +
        `${links.length} matches (${viaSummary})`,
    );
    if (sample.length) console.log(sample.join("\n"));

    if (APPLY && links.length > 0) {
      let linked = 0;
      let promoted = 0;
      let raced = 0;
      for (const { residentId, leadId, convertedAt } of links) {
        // Conditional claim: the candidate list was read before this loop,
        // so an operator could have linked this resident (via the lead
        // detail "Mark as signed" control) in between. leadId: null makes
        // the DB reject that overwrite instead of us clobbering their work.
        const claim = await prisma.resident.updateMany({
          where: { id: residentId, leadId: null, leadLinkManual: false },
          data: { leadId },
        });
        if (claim.count === 0) {
          raced++;
          continue;
        }
        linked++;
        const res = await prisma.lead.updateMany({
          where: { id: leadId, status: { in: LEAD_STATUSES_BELOW_SIGNED } },
          data: {
            status: "SIGNED" as LeadStatus,
            convertedAt,
            lastActivityAt: new Date(),
          },
        });
        promoted += res.count;
      }
      console.log(
        `  APPLIED: ${linked} residents linked, ${promoted} leads promoted to SIGNED` +
          (raced > 0 ? `, ${raced} skipped (linked by someone else meanwhile)` : "") +
          "\n",
      );
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
