/**
 * Diagnostic: list every popup campaign for orgs whose slug contains
 * "sg" or "telegraph" and show status + 28-day event counters. Norman
 * filed bugs #92 + #93 expecting two active popups on Telegraph
 * Commons (promo on landing + doubles on listing page) with historical
 * shown counts — if either is missing or non-ACTIVE, the public events
 * route silently drops every event so the dashboard shows zero.
 *
 * Re-runnable, read-only.
 */
import { prisma } from "../lib/db";

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: { contains: "sg", mode: "insensitive" } },
        { slug: { contains: "telegraph", mode: "insensitive" } },
        { name: { contains: "telegraph", mode: "insensitive" } },
        { name: { contains: "sg real", mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, name: true, modulePopups: true },
  });

  console.log(`Found ${orgs.length} matching org(s).`);
  for (const o of orgs) {
    console.log(`\n── ${o.name} (slug=${o.slug}, modulePopups=${o.modulePopups})`);
    const popups = await prisma.popupCampaign.findMany({
      where: { orgId: o.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        headline: true,
        trigger: true,
        targetUrlPatterns: true,
        shownCount: true,
        ctaClickCount: true,
        convertedCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (popups.length === 0) {
      console.log("  (no popup campaigns)");
      continue;
    }

    for (const p of popups) {
      const targets = Array.isArray(p.targetUrlPatterns)
        ? (p.targetUrlPatterns as string[]).join(" | ")
        : "(any)";
      console.log(
        `  • ${p.name}  [${p.status}]  trigger=${p.trigger}  targets=${targets}`,
      );
      console.log(
        `      "${p.headline}"  · shown=${p.shownCount}  clicks=${p.ctaClickCount}  converted=${p.convertedCount}`,
      );
      console.log(
        `      created ${p.createdAt.toISOString()} · updated ${p.updatedAt.toISOString()}`,
      );

      // Cross-check against the PopupEvent table directly — the
      // counters above are denormalized aggregates. If the events
      // table has rows but the counters are zero, the dedupe path or
      // a backfill bug is at fault.
      const eventCount = await prisma.popupEvent.count({
        where: { campaignId: p.id },
      });
      const eventCounts = await prisma.popupEvent.groupBy({
        by: ["type"],
        where: { campaignId: p.id },
        _count: { _all: true },
      });
      const summary = eventCounts
        .map((e) => `${e.type}=${e._count._all}`)
        .join(" ");
      console.log(
        `      raw events: ${eventCount} (${summary || "none"})`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
