import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { generateReportSnapshot } from "../lib/reports/generate";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

// ---------------------------------------------------------------------------
// Refresh the SG Real Estate shared reports in-place. Re-runs
// generateReportSnapshot for each shared TC/SG ClientReport row and
// UPDATEs the snapshot column without touching shareToken / status /
// viewCount, so Norman's existing share links stay live and immediately
// reflect the new lifecycle pipeline + flagship-property fix.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

(async () => {
  const orgs = await prisma.organization.findMany({
    where: {
      slug: { in: ["telegraph-commons", "sg-real-estate"] },
    },
    select: { id: true, name: true, slug: true },
  });
  if (orgs.length === 0) throw new Error("no SG/TC org found");

  for (const org of orgs) {
    const shared = await prisma.clientReport.findMany({
      where: { orgId: org.id, status: "shared" },
      select: { id: true, kind: true, headline: true, shareToken: true },
      orderBy: { updatedAt: "desc" },
    });
    if (shared.length === 0) {
      console.log(`[${org.name}] no shared reports`);
      continue;
    }
    for (const r of shared) {
      console.log(`[${org.name}] regenerating ${r.kind} "${r.headline}" …`);
      const snap = await generateReportSnapshot(
        org.id,
        r.kind as "weekly" | "monthly",
      );
      await prisma.clientReport.update({
        where: { id: r.id },
        data: {
          snapshot: snap as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });
      const signed = snap.funnel.find((s) => s.stage === "Signed")?.count ?? 0;
      const active = snap.lifecycleStats?.activeLeases ?? 0;
      console.log(
        `  → Signed ${signed} · Active leases ${active} · https://www.leasestack.co/r/${r.shareToken}`,
      );
    }
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
