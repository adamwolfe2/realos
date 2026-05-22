import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const all = await prisma.bugReport.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, description: true, severity: true, status: true, pagePath: true, pageUrl: true, reporterEmail: true, reporterOrgName: true, createdAt: true, githubIssueNumber: true, resolutionNote: true, timeline: true },
  });

  console.log(`TOTAL: ${all.length} bug reports\n`);
  const byStatus = all.reduce((a: any, b) => { a[b.status] = (a[b.status]||0)+1; return a; }, {});
  console.log(`Status: ${JSON.stringify(byStatus)}`);
  const bySev = all.reduce((a: any, b) => { a[b.severity] = (a[b.severity]||0)+1; return a; }, {});
  console.log(`Severity: ${JSON.stringify(bySev)}`);
  const byReporter = all.reduce((a: any, b) => { a[b.reporterEmail] = (a[b.reporterEmail]||0)+1; return a; }, {});
  console.log(`Reporters: ${JSON.stringify(byReporter)}\n`);

  console.log(`=== ALL ${all.length} REPORTS ===`);
  all.forEach((b, i) => {
    const ts = (b.timeline && Array.isArray(b.timeline)) ? (b.timeline as any[]).length : 0;
    console.log(`\n[${i+1}] #${b.githubIssueNumber ?? '?'} ${b.severity} ${b.status} — ${b.title}`);
    console.log(`    ${b.pagePath ?? '-'}  by ${b.reporterEmail.split('@')[0]}@ ${b.createdAt.toISOString().slice(0,10)}  timeline=${ts}`);
    console.log(`    ${b.description.slice(0, 300).replace(/\n+/g, ' ')}`);
    if (b.resolutionNote) console.log(`    RESOLUTION: ${b.resolutionNote.slice(0, 200)}`);
  });

  await prisma.$disconnect();
})();
