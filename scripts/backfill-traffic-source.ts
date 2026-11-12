/**
 * One-off: tag existing chatbot conversations + leads with a first-touch
 * traffic source when the page they started on carried UTM / click-id tags
 * (e.g. ?utm_source=zillow). Rows with an untagged page stay NULL ("Not
 * tracked") — we never guess. Only fills NULL rows; idempotent.
 *
 *   pnpm tsx scripts/backfill-traffic-source.ts            # dry run
 *   pnpm tsx scripts/backfill-traffic-source.ts --apply    # write
 *
 * Run after migration 20261111_lead_traffic_source is deployed.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import {
  ATTRIBUTION_FILL_WINDOW_MS,
  attributionColumns,
  resolveAttribution,
} from "../lib/attribution/touch";

neonConfig.webSocketConstructor = ws;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: connectionString.replace(/-pooler\./, ".") }),
});
const APPLY = process.argv.includes("--apply");

// Lead.sourceDetail is "chatbot:<pageUrl>" for in-chat captures.
function urlFromSourceDetail(detail: string | null): string | null {
  if (!detail) return null;
  const m = detail.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

async function main() {
  const convos = await prisma.chatbotConversation.findMany({
    where: { trafficSource: null, pageUrl: { contains: "?" } },
    select: { id: true, pageUrl: true, leadId: true },
  });
  const convoUpdates = convos
    .map((c) => ({ c, a: resolveAttribution({ touch: undefined, pageUrl: c.pageUrl }) }))
    .filter((x) => x.a);

  const leads = await prisma.lead.findMany({
    where: { trafficSource: null, externalSystem: null },
    select: {
      id: true,
      createdAt: true,
      sourceDetail: true,
      conversations: {
        select: { pageUrl: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
    },
  });
  const leadUpdates = leads
    .map((l) => {
      // Only a chat that started with the lead itself (within 24h) says how the
      // lead arrived; a later tagged chat is a return visit, not the origin.
      const atCapture = l.conversations.filter(
        (c) => Math.abs(c.createdAt.getTime() - l.createdAt.getTime()) <= ATTRIBUTION_FILL_WINDOW_MS,
      );
      const urls = [urlFromSourceDetail(l.sourceDetail), ...atCapture.map((c) => c.pageUrl)];
      for (const pageUrl of urls) {
        const a = resolveAttribution({ touch: undefined, pageUrl });
        if (a) return { id: l.id, a };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const tally = (xs: Array<{ a: ReturnType<typeof resolveAttribution> }>) =>
    xs.reduce<Record<string, number>>((acc, x) => {
      const k = x.a?.attribution.sourceLabel ?? "?";
      return { ...acc, [k]: (acc[k] ?? 0) + 1 };
    }, {});
  console.log(`conversations: ${convoUpdates.length}/${convos.length} tagged`, tally(convoUpdates));
  console.log(`leads: ${leadUpdates.length}/${leads.length} tagged`, tally(leadUpdates));
  if (!APPLY) {
    console.log("dry run; pass --apply to write");
    return;
  }
  for (const { c, a } of convoUpdates) {
    await prisma.chatbotConversation.updateMany({
      where: { id: c.id, trafficSource: null },
      data: attributionColumns(a),
    });
  }
  for (const { id, a } of leadUpdates) {
    await prisma.lead.updateMany({ where: { id, trafficSource: null }, data: attributionColumns(a) });
  }
  console.log("applied");
}

main()
  .catch((err) => {
    console.error("[backfill-traffic-source] failed", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
