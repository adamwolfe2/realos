import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { TEST_TENANT } from "../fixtures/test-tenant";

// Global setup runs once per Playwright invocation. It just confirms the
// seeded test tenant exists in the DB so individual specs don't have to
// rediscover it. If DATABASE_URL isn't set we fail loudly — marketing-page
// tests would still pass without a DB but tenant-flow tests would fail
// mysteriously.

export default async function globalSetup(): Promise<void> {
  // reuseExistingServer trap: if a dev server is already up on :3000 its
  // auth mode wins, not this run's env. Fail loudly on a mismatch instead
  // of letting half the suite fail with confusing redirects.
  const wantDemo = process.env.E2E_DEMO !== "false";
  try {
    const res = await fetch("http://localhost:3000/portal", {
      redirect: "manual",
    });
    const redirected =
      res.status >= 300 &&
      res.status < 400 &&
      (res.headers.get("location") ?? "").includes("/sign-in");
    if (wantDemo && redirected) {
      throw new Error(
        "A dev server WITHOUT demo mode is already running on :3000. " +
          "Stop it (or restart it with DEMO_MODE=true DEMO_TARGET=client) " +
          "before running the authed e2e suite."
      );
    }
    if (!wantDemo && !redirected) {
      throw new Error(
        "A dev server WITH demo mode is already running on :3000, but " +
          "E2E_DEMO=false was requested. Stop it first."
      );
    }
  } catch (error) {
    // Connection refused = no existing server; Playwright will start one
    // with the right env. Anything else (incl. our mismatch errors) rethrows.
    if (!(error instanceof TypeError)) throw error;
  }

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
