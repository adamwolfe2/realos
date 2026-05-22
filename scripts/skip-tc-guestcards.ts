/**
 * Manually mark the guest_cards phase as auto-skipped for SG Real Estate.
 * Their AppFolio plan doesn't expose the report; auto-skip kicks in after
 * 3 consecutive failures but we've only had 2 so the partial-success
 * banner keeps firing on every portal page. SG has confirmed the plan
 * limitation — promoting to skipped now so the banner reads "synced"
 * instead of "completed with warnings" and Norman stops staring at a
 * "broken integration" message during the demo.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const integ = await prisma.appFolioIntegration.findUnique({ where: { orgId: org!.id } });
  if (!integ?.lastSyncStats) { console.log("no stats"); return; }
  const stats = integ.lastSyncStats as any;
  stats.phaseFailures = stats.phaseFailures ?? {};
  stats.phaseFailures.leads = {
    ...(stats.phaseFailures.leads ?? {}),
    skipped: true,
    skippedReason: "guest_cards report not available on this AppFolio plan",
    skippedAt: new Date().toISOString(),
  };
  stats.phasesSkipped = 1;
  // Drop the warning so the banner copy stops showing "First warning: leads…"
  stats.warnings = (stats.warnings ?? []).filter(
    (w: string) => !w.includes("guest_cards") && !w.startsWith("leads:"),
  );
  await prisma.appFolioIntegration.update({
    where: { orgId: org!.id },
    data: { lastSyncStats: stats as Prisma.InputJsonValue },
  });
  console.log("guest_cards marked as auto-skipped for SG. Banner should read 'synced' on next page load.");
  await prisma.$disconnect();
})();
