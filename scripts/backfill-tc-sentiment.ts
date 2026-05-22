/**
 * Backfill sentiment classification for existing PropertyMention rows that
 * have sentiment=null. The Claude analyze schema bug (min/max not supported)
 * was just fixed in lib/reputation/analyze.ts. Re-run sentiment over all
 * existing TC mentions so the demo shows POSITIVE/NEGATIVE/NEUTRAL labels
 * and the negative-mention alerts can fire.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { prisma } from "@/lib/db";
import { backfillSentimentForOrg } from "@/lib/reputation/sentiment";

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("no TC org");
  console.log(`Backfilling sentiment for ${org.name}…`);
  const result = await backfillSentimentForOrg(org.id, { batchSize: 50 });
  console.log(`Classified: ${result.classified}`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
