/**
 * One-off: archive "Yosemite Avenue Apartments" so it stops surfacing
 * in the SG Real Estate property list. Norman filed bug reports #51 and
 * #65 asking us to hide it until the property is actively onboarded.
 *
 * Lifecycle ARCHIVED is filtered out by withMarketableLifecycle() unless
 * the caller explicitly opts in via { includeArchived: true }, so
 * setting it here is enough to remove the property from every list /
 * curate / dashboard surface in one shot. lifecycleSetBy=OPERATOR
 * prevents the AppFolio sync from re-flipping it back to ACTIVE on the
 * next round-trip.
 *
 * Re-runnable: idempotent name-match.
 *
 * Usage: pnpm tsx scripts/archive-yosemite.ts
 */
import { prisma } from "../lib/db";

async function main() {
  const matches = await prisma.property.findMany({
    where: { name: { contains: "Yosemite", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      lifecycle: true,
      lifecycleSetBy: true,
      orgId: true,
    },
  });

  if (matches.length === 0) {
    console.log("No properties matching 'Yosemite' — nothing to archive.");
    return;
  }

  for (const p of matches) {
    if (p.lifecycle === "ARCHIVED" && p.lifecycleSetBy === "OPERATOR") {
      console.log(
        `[skip] ${p.name} (${p.id}) already ARCHIVED by operator — no change.`,
      );
      continue;
    }
    await prisma.property.update({
      where: { id: p.id },
      data: { lifecycle: "ARCHIVED", lifecycleSetBy: "OPERATOR" },
    });
    console.log(
      `[archived] ${p.name} (${p.id}) — was ${p.lifecycle} (set by ${p.lifecycleSetBy})`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
