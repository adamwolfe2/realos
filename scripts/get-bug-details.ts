import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const ids = [69, 70, 72, 73, 77, 80, 87, 88, 90, 97, 103, 104, 105, 106, 107, 108, 67, 75, 74, 91, 92, 93, 100, 101];
  for (const issueNum of ids) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: issueNum }, select: { title: true, description: true, pagePath: true, severity: true, status: true } });
    if (!b) continue;
    console.log(`\n#${issueNum} [${b.severity} ${b.status}] ${b.title} (${b.pagePath})`);
    console.log(`${b.description.slice(0, 600).replace(/\n+/g, ' | ')}`);
  }
  await prisma.$disconnect();
})();
