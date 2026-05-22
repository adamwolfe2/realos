/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Fix TC (Telegraph Commons) share tokens.
//
// Earlier regen script created 32-char hex tokens via randomBytes(16).toString("hex").
// The validator in lib/reports/token.ts requires exactly 24 chars of base64url
// (/^[A-Za-z0-9_-]{24}$/), so /r/[token] returns 404 for every report it touched.
//
// This script:
//   1) finds all "shared" ClientReports whose shareToken length !== 24,
//   2) rewrites them with generateShareToken(),
//   3) prints the new public URL for each.
// ---------------------------------------------------------------------------

import { prisma } from "../lib/db";
import { generateShareToken } from "../lib/reports/token";

async function main() {
  const reports = await prisma.clientReport.findMany({
    where: { status: "shared" },
    select: {
      id: true,
      shareToken: true,
      headline: true,
      org: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const broken = reports.filter(
    (r) => !r.shareToken || r.shareToken.length !== 24,
  );

  if (broken.length === 0) {
    console.log("All shared reports already have valid 24-char tokens.");
    return;
  }

  console.log(`Found ${broken.length} report(s) with invalid token format.`);
  console.log("");

  for (const r of broken) {
    const newToken = generateShareToken();
    await prisma.clientReport.update({
      where: { id: r.id },
      data: { shareToken: newToken },
    });
    console.log(
      `[${r.org?.name ?? "?"}] ${r.headline ?? r.id}\n  → https://www.leasestack.co/r/${newToken}\n`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
