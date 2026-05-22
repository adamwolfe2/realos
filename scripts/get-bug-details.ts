import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const ids = [65, 66, 71, 76, 79, 94, 95, 98, 102, 109];
  for (const issueNum of ids) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: issueNum }, select: { title: true, description: true, pagePath: true, pageUrl: true } });
    if (!b) { console.log(`\n=== #${issueNum} NOT FOUND ===`); continue; }
    console.log(`\n=== #${issueNum}: ${b.title} ===`);
    console.log(`Path: ${b.pagePath}`);
    console.log(`Description:\n${b.description}`);
  }
  await prisma.$disconnect();
})();
