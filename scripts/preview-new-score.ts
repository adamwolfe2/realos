import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no TC");
  const last30 = await prisma.aeoCitationCheck.findMany({
    where: { orgId: org.id, queryRunAt: { gte: new Date(Date.now() - 30*86400000) } },
    select: { status: true, mentioned: true, position: true, prompt: true },
  });

  const total = last30.length;
  const mentioned = last30.filter(c => c.mentioned).length;
  const cited = last30.filter(c => c.status === 'CITED').length;
  const mentionRate = total > 0 ? mentioned/total : 0;
  const citationRate = total > 0 ? cited/total : 0;

  const BRANDED = [
    /^tell me about /i,
    /^what do residents say about /i,
    /^what are the amenities and pricing like at /i,
    / reviews — what are the most common /i,
  ];
  const branded = last30.filter(c => BRANDED.some(re => re.test(c.prompt)));
  const brandedMentioned = branded.filter(c => c.mentioned).length;
  const brandedRate = branded.length > 0 ? brandedMentioned/branded.length : 0;

  // positionBonus = 0 (we don't track position from LLM responses)
  const score = Math.round(mentionRate * 50 + citationRate * 30 + 0 * 5 + brandedRate * 15);

  console.log(`Last 30 days for TC after scan:`);
  console.log(`  Total checks:         ${total}`);
  console.log(`  Mentioned:            ${mentioned} (${Math.round(mentionRate*100)}%)`);
  console.log(`  Cited:                ${cited} (${Math.round(citationRate*100)}%)`);
  console.log(`  Branded prompts:      ${branded.length}`);
  console.log(`  Branded mentioned:    ${brandedMentioned} (${Math.round(brandedRate*100)}%)`);
  console.log(`  AI Visibility Score:  ${score}/100`);
  await prisma.$disconnect();
})();
