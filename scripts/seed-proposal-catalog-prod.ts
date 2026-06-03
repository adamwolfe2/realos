/**
 * One-shot — run ensureCatalogSeeded() against whichever DB the env
 * points at. For prod use:
 *
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx scripts/seed-proposal-catalog-prod.ts
 *
 * Idempotent: upserts on slug, so re-runs are safe. Logs the row count
 * for confirmation.
 */
import { ensureCatalogSeeded } from "../lib/proposals/catalog";
import { prisma } from "../lib/db";

(async () => {
  const url = process.env.DATABASE_URL ?? "(unset)";
  const safe = url
    .replace(/:\/\/[^:]+:[^@]+@/, "://****:****@")
    .slice(0, 100);
  console.log(`[seed-proposal-catalog] DB: ${safe}…`);
  const r = await ensureCatalogSeeded();
  console.log(
    `[seed-proposal-catalog] upserted=${r.upserted} total=${r.total}`,
  );
  const counts = await prisma.proposalCatalogItem.groupBy({
    by: ["kind"],
    _count: { id: true },
  });
  console.log("[seed-proposal-catalog] by kind:", counts);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
