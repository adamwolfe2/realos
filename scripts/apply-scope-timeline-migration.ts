import { prisma as p } from "../lib/db";

(async () => {
  try {
    await p.$executeRawUnsafe(
      `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "scopeNarrative" TEXT`,
    );
    console.log("✓ scopeNarrative column added");
    await p.$executeRawUnsafe(
      `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "timeline" JSONB`,
    );
    console.log("✓ timeline column added");
  } catch (e) {
    console.error(
      "Migration error:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }
  await p.$disconnect();
})();
