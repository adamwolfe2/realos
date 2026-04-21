import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { TEST_TENANT } from "../fixtures/test-tenant";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import crypto from "node:crypto";

// Mirrors lib/api-keys/public-site-key.ts. Duplicated (not imported)
// because that module imports "server-only" which Node refuses to load
// outside the React Server Component graph.
const KEY_PREFIX = "pk_site_";
const PREFIX_DISPLAY_LENGTH = 12;
const BODY_LENGTH = 32;
const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomBase62(length: number): string {
  const bytes = crypto.randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i += 1) {
    if (bytes[i] < 248) out += BASE62[bytes[i] % 62];
  }
  if (out.length < length) return out + randomBase62(length - out.length);
  return out;
}

function generatePublicSiteKey(): { raw: string; prefix: string } {
  const raw = `${KEY_PREFIX}${randomBase62(BODY_LENGTH)}`;
  return { raw, prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH) };
}

// Global setup runs once per Playwright invocation. We use it to:
//   1. Confirm the seeded test tenant exists.
//   2. Provision a pixel key on that tenant if one doesn't exist yet, so
//      pixel-firing tests can hit /api/public/visitors/track end-to-end.
//   3. Persist the test tenant id + pixel key to a JSON file under
//      e2e/.cache/ so individual specs can read them without re-running
//      DB queries.
//
// If DATABASE_URL isn't set we fail loudly — the marketing-page tests
// would still pass without a DB, but the lead-capture and pixel tests
// would fail mysteriously.

const CACHE_PATH = resolve(__dirname, "../.cache/test-state.json");

export type GlobalTestState = {
  orgId: string;
  publicSiteKey: string;
  publicKeyPrefix: string;
};

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

    // Make sure a CursiveIntegration row exists with a public_site_key.
    let integ = await prisma.cursiveIntegration.findUnique({
      where: { orgId: org.id },
      select: { publicSiteKey: true, publicKeyPrefix: true },
    });
    if (!integ?.publicSiteKey) {
      const generated = generatePublicSiteKey();
      await prisma.cursiveIntegration.upsert({
        where: { orgId: org.id },
        create: {
          orgId: org.id,
          publicSiteKey: generated.raw,
          publicKeyPrefix: generated.prefix,
          publicKeyIssuedAt: new Date(),
        },
        update: {
          publicSiteKey: generated.raw,
          publicKeyPrefix: generated.prefix,
          publicKeyIssuedAt: new Date(),
        },
      });
      integ = { publicSiteKey: generated.raw, publicKeyPrefix: generated.prefix };
    }

    const state: GlobalTestState = {
      orgId: org.id,
      publicSiteKey: integ.publicSiteKey!,
      publicKeyPrefix: integ.publicKeyPrefix ?? integ.publicSiteKey!.slice(0, 12),
    };

    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(state, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

export function cachePath(): string {
  return CACHE_PATH;
}
