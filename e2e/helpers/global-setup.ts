import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { TEST_TENANT } from "../fixtures/test-tenant";

// Global setup runs once per Playwright invocation. It just confirms the
// seeded test tenant exists in the DB so individual specs don't have to
// rediscover it. If DATABASE_URL isn't set we fail loudly — marketing-page
// tests would still pass without a DB but tenant-flow tests would fail
// mysteriously.

export default async function globalSetup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is not set. Source .env.local before running e2e tests: " +
        "`set -a && source .env.local && set +a && pnpm test:e2e`"
    );
  }

  const adapter = new PrismaNeonHttp(dbUrl, {} as never);
  const prisma = new PrismaClient({ adapter });

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: TEST_TENANT.slug },
      select: { id: true, slug: true, orgType: true },
    });
    if (!org || org.orgType !== "CLIENT") {
      throw new Error(
        `Test tenant ${TEST_TENANT.slug} not found in DB or not a CLIENT org. ` +
          `Run \`pnpm db:seed\` first.`
      );
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
