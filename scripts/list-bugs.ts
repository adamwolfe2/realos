import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

(async () => {
  const { prisma } = await import("@/lib/db");
  const reports = await prisma.bugReport.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] as any } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      status: true,
      pagePath: true,
      reporterEmail: true,
      reporterRole: true,
      createdAt: true,
    },
  });
  console.log(JSON.stringify(reports, null, 2));
  await prisma.$disconnect();
})();
