import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { prisma } from "../lib/db";
import { runSourceReplenish } from "../lib/marketplace/cursive-sync";

(async () => {
  const src = await prisma.marketplaceSyncSource.findFirst({
    where: { name: "Real Estate test leads" },
  });
  if (!src) {
    console.error("Source 'Real Estate test leads' not found.");
    process.exit(1);
  }
  console.log("Syncing source:", src.name, "ext:", src.externalId);
  const summary = await runSourceReplenish(src);
  console.log("Sync result:", JSON.stringify(summary, null, 2));

  const counts = await prisma.marketplaceLead.groupBy({
    by: ["status"],
    where: { sourceId: src.id },
    _count: { _all: true },
  });
  console.log("Leads now under this source:");
  counts.forEach((c) => console.log(" ", c.status, c._count._all));

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
