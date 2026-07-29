// What do the LOSING conversations actually look like? The capture-rate audit
// says all the loss is in turns 1-3. This prints those conversations verbatim
// so we fix the real failure instead of guessing at it.
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

type Msg = { role?: string; content?: string };

(async () => {
  const org = await prisma.organization.findFirst({
    where: { slug: "telegraph-commons" },
  });
  if (!org) throw new Error("no SG org");

  const convos = await prisma.chatbotConversation.findMany({
    where: { orgId: org.id, capturedEmail: null, capturedPhone: null },
    select: { sessionId: true, messages: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const engaged = convos.filter(
    (c) => Array.isArray(c.messages) && (c.messages as Msg[]).some((m) => m?.role === "user"),
  );

  console.log(`${engaged.length} engaged-but-uncaptured conversations. Showing the most recent 25:\n`);

  for (const c of engaged.slice(0, 25)) {
    const msgs = (c.messages as Msg[]).filter((m) => m?.role === "user" || m?.role === "assistant");
    console.log(`--- ${c.createdAt.toISOString().slice(0, 16)} (${msgs.filter((m) => m.role === "user").length} user turns)`);
    for (const m of msgs.slice(0, 6)) {
      const who = m.role === "user" ? "USER" : "BOT ";
      console.log(`  ${who} ${(m.content ?? "").replace(/\s+/g, " ").slice(0, 220)}`);
    }
    console.log("");
  }

  await prisma.$disconnect();
})();
