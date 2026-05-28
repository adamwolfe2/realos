import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// Usage: node --import tsx scripts/mark-bug.ts <bugId> <status> [note]
// Status: PENDING | IN_PROGRESS | FIXED | APPROVED | REJECTED
(async () => {
  const [bugId, status, note] = process.argv.slice(2);
  if (!bugId || !status) {
    console.error("Usage: mark-bug.ts <bugId> <status> [note]");
    process.exit(1);
  }
  const { prisma } = await import("@/lib/db");
  const updated = await prisma.bugReport.update({
    where: { id: bugId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: status as any, ...(note ? { resolutionNote: note } : {}) },
    select: { id: true, status: true, title: true },
  });
  console.log("Updated:", updated);
  await prisma.$disconnect();
})();
