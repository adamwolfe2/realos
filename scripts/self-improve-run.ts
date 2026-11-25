// Run the self-improve pass (SG cockpit slice 4) for one workspace by hand:
// the same code as the weekly cron and the "Generate now" button.
//
//   npx tsx --require ./scripts/_no-server-only.cjs scripts/self-improve-run.ts --org telegraph-commons
//     dry run: lists the signals per property; no model call, no writes
//   ... --apply   drafts with the model and writes OPEN proposals (nothing is applied)
//
// Env: .env.production.local (prod DB). Override DATABASE_URL to target a scratch branch.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production.local" });
import { parseArgs } from "node:util";
import { prisma } from "@/lib/db";
import { generateProposals } from "@/lib/self-improve/generate";
import { readProposal } from "@/lib/self-improve/proposal";

const { values: args } = parseArgs({ options: { org: { type: "string" }, apply: { type: "boolean", default: false } } });

async function main() {
  if (!args.org) throw new Error("--org <slug> is required");
  const org = await prisma.organization.findUnique({ where: { slug: args.org }, select: { id: true, name: true } });
  if (!org) throw new Error(`No org with slug ${args.org}`);
  const started = new Date();
  const r = await generateProposals(org.id, { dryRun: !args.apply });
  console.log(JSON.stringify({ org: org.name, ...r }, null, 2));
  if (!args.apply) return;

  const kb = await prisma.chatbotKnowledgeSuggestion.findMany({
    where: { orgId: org.id, dedupeKey: { startsWith: "si:" }, createdAt: { gte: started } },
    select: { suggestedText: true, proposal: true, property: { select: { name: true } } },
  });
  for (const k of kb) {
    const p = readProposal(k.proposal);
    console.log(`\n[${k.property?.name}] Q: ${p?.question}\n  ${p?.needsAnswer ? `NEEDS SG'S ANSWER: ${p.askSg}` : `Draft: ${k.suggestedText}\n  Grounded in: ${p?.grounding}`}${p?.fairHousing ? "\n  (fair-housing topic)" : ""}`);
  }
  const site = await prisma.siteImprovementRecommendation.findMany({
    where: { orgId: org.id, dedupeKey: { startsWith: "si:" }, createdAt: { gte: started } },
    select: { suggestedTitle: true, suggestedBody: true, proposal: true, property: { select: { name: true } } },
  });
  for (const s of site) {
    const p = readProposal(s.proposal);
    console.log(`\n[${s.property?.name}] ${s.suggestedTitle}\n  ${p?.popup ? `"${p.popup.current.headline}" -> "${p.popup.proposed.headline}" / ${p.popup.current.delaySeconds}s -> ${p.popup.proposed.delaySeconds}s\n  ` : ""}${s.suggestedBody}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
