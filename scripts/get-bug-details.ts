import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const ids = [64, 67, 68, 72, 73, 74, 75, 78, 85, 86, 88, 89, 99, 105, 106];
  for (const issueNum of ids) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: issueNum }, select: { title: true, description: true, pagePath: true, severity: true } });
    if (!b) continue;
    console.log(`\n#${issueNum} ${b.severity} ${b.title} (${b.pagePath})\n${b.description.slice(0, 500).replace(/\n+/g, ' | ')}`);
  }
  await prisma.$disconnect();
})();
