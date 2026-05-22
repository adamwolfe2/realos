import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

(async () => {
  const r = await prisma.clientReport.findUnique({
    where: { shareToken: "TTuALcFefjAFdoH1-az30DWb" },
    select: { id: true, snapshot: true, headline: true, generatedAt: true },
  });
  if (!r) throw new Error("no report");
  console.log("Headline:", r.headline);
  console.log("Generated:", r.generatedAt);
  const snap = r.snapshot as any;
  console.log("\nTraffic trend (28 days):");
  console.log(snap.trafficTrend);
  console.log(
    "\nNon-zero count:",
    snap.trafficTrend.filter((v: number) => v > 0).length,
  );
  console.log("Max:", Math.max(...snap.trafficTrend));
  console.log("\nLifecycle:");
  console.log(snap.lifecycleStats);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
