import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("not found");

  // Get all 29 conversations with messages
  const convs = await prisma.chatbotConversation.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, status: true, messageCount: true, capturedEmail: true, capturedName: true, capturedPhone: true, messages: true, pageUrl: true, visitorHash: true },
  });

  console.log(`Total: ${convs.length} conversations\n`);
  console.log(`Status breakdown:`);
  const byStatus = convs.reduce((a: any, c) => { a[c.status] = (a[c.status]||0)+1; return a; }, {});
  console.log(byStatus);

  console.log(`\n=== SAMPLE CONVERSATIONS (first 5) ===`);
  for (const c of convs.slice(0, 5)) {
    console.log(`\n--- ${c.createdAt.toISOString()} status=${c.status} msgs=${c.messageCount}`);
    console.log(`  url: ${c.pageUrl}`);
    console.log(`  email: ${c.capturedEmail ?? '-'} name: ${c.capturedName ?? '-'} phone: ${c.capturedPhone ?? '-'}`);
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    msgs.forEach((m: any, i: number) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      console.log(`  [${i}] ${m.role}: ${content?.slice(0, 200)}`);
    });
  }

  // Are any captured? Look at the 3 successful ones
  console.log(`\n=== LEAD_CAPTURED conversations ===`);
  const captured = convs.filter(c => c.status === 'LEAD_CAPTURED');
  for (const c of captured) {
    console.log(`\n--- ${c.createdAt.toISOString()} email=${c.capturedEmail}`);
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    msgs.forEach((m: any, i: number) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      console.log(`  [${i}] ${m.role}: ${content?.slice(0, 300)}`);
    });
  }

  await prisma.$disconnect();
})();
