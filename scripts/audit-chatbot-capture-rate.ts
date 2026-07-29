// Chatbot capture rate — the Slice A baseline.
// How many conversations happened vs how many produced a contactable lead
// (email or phone). Splits by conversation depth so we can see WHERE we lose
// them: a 1-turn bounce is not the same failure as a 6-turn chat that never
// got asked well.
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

type Msg = { role?: string; content?: string };

function userTurns(messages: unknown): number {
  if (!Array.isArray(messages)) return 0;
  return (messages as Msg[]).filter((m) => m?.role === "user").length;
}

(async () => {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
  });

  for (const org of orgs) {
    const convos = await prisma.chatbotConversation.findMany({
      where: { orgId: org.id },
      select: {
        sessionId: true,
        messages: true,
        capturedEmail: true,
        capturedPhone: true,
        capturedName: true,
        leadId: true,
        visitorHash: true,
        createdAt: true,
      },
    });
    if (convos.length === 0) continue;

    // A conversation only counts as a real chance to capture if a human said
    // something. Widget-open-with-greeting rows are not failed captures.
    const engaged = convos.filter((c) => userTurns(c.messages) > 0);
    const contactable = engaged.filter((c) => c.capturedEmail || c.capturedPhone);
    const linked = engaged.filter((c) => c.leadId);
    const stitched = engaged.filter((c) => c.visitorHash);

    const pct = (n: number) => (engaged.length ? ((n / engaged.length) * 100).toFixed(1) : "0.0");

    console.log(`\n=== ${org.name} (${org.slug}) ===`);
    console.log(`  conversations:        ${convos.length}`);
    console.log(`  engaged (>=1 user turn): ${engaged.length}`);
    console.log(`  contactable (email|phone): ${contactable.length}  (${pct(contactable.length)}% CAPTURE RATE)`);
    console.log(`  linked to a Lead row:  ${linked.length}  (${pct(linked.length)}%)`);
    console.log(`  has visitorHash:       ${stitched.length}  (${pct(stitched.length)}%)`);

    // Where do we lose them? Capture rate by how long the conversation ran.
    const buckets: Record<string, { n: number; got: number }> = {};
    for (const c of engaged) {
      const t = userTurns(c.messages);
      const key = t === 1 ? "1 turn" : t <= 3 ? "2-3 turns" : t <= 6 ? "4-6 turns" : "7+ turns";
      buckets[key] ??= { n: 0, got: 0 };
      buckets[key].n++;
      if (c.capturedEmail || c.capturedPhone) buckets[key].got++;
    }
    console.log(`  --- capture rate by depth ---`);
    for (const key of ["1 turn", "2-3 turns", "4-6 turns", "7+ turns"]) {
      const b = buckets[key];
      if (!b) continue;
      console.log(
        `    ${key.padEnd(10)} ${String(b.n).padStart(4)} convos  ${String(b.got).padStart(4)} captured  ${((b.got / b.n) * 100).toFixed(1)}%`,
      );
    }
  }

  await prisma.$disconnect();
})();
