/**
 * scripts/seed-vault-demo.ts
 *
 * One-shot seed that:
 *   1. Enables moduleVault on the Telegraph Commons demo org
 *   2. Seeds ~20 realistic credentials across the 4 demo properties
 *      (and a few org-wide ones)
 *
 * The encryption uses VAULT_MASTER_KEK_B64 from env — the same KEK
 * the Vercel runtime will use. As long as the same KEK is set both
 * here AND in Vercel env vars, the seeded credentials are decryptable
 * in prod.
 *
 * Run:
 *   set -a; source .env.production.local; set +a; \
 *   VAULT_MASTER_KEK_B64="..." pnpm tsx scripts/seed-vault-demo.ts
 *
 * Idempotent: re-running deletes existing seed rows (tagged with the
 * "demo-seed" tag) before re-inserting.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production.local", override: false });
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { randomBytes, createCipheriv } from "node:crypto";

neonConfig.webSocketConstructor = ws;

const KEK_B64 = process.env.VAULT_MASTER_KEK_B64;
if (!KEK_B64) {
  console.error(
    "VAULT_MASTER_KEK_B64 env var missing. Generate with `openssl rand -base64 32` and pass it.",
  );
  process.exit(1);
}
const KEK = Buffer.from(KEK_B64.trim(), "base64");
if (KEK.length !== 32) {
  console.error(
    `VAULT_MASTER_KEK_B64 must decode to 32 bytes (got ${KEK.length}).`,
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({
  connectionString: connectionString.replace(/-pooler\./, "."),
});
const prisma = new PrismaClient({ adapter });

const DEMO_ORG_SLUG = "telegraph-commons-demo";
const SEED_TAG = "demo-seed";

// ─── Crypto helpers (mirror lib/vault/crypto.ts) ───────────────────────
function encryptGcm(plaintext: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

async function getOrMintOrgDek(orgId: string): Promise<Buffer> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { vaultDekWrapped: true, vaultDekNonce: true },
  });
  if (!org) throw new Error(`Org ${orgId} not found`);
  if (org.vaultDekWrapped && org.vaultDekNonce) {
    // Unwrap existing
    const wrapped = Buffer.from(org.vaultDekWrapped);
    const nonce = Buffer.from(org.vaultDekNonce);
    const tag = wrapped.subarray(wrapped.length - 16);
    const ct = wrapped.subarray(0, wrapped.length - 16);
    const { createDecipheriv } = await import("node:crypto");
    const d = createDecipheriv("aes-256-gcm", KEK, nonce);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]);
  }
  // Mint new
  const dek = randomBytes(32);
  const { ciphertext, iv, tag } = encryptGcm(dek, KEK);
  const wrapped = Buffer.concat([ciphertext, tag]);
  const wrappedAb = new Uint8Array(new ArrayBuffer(wrapped.length));
  wrappedAb.set(wrapped);
  const ivAb = new Uint8Array(new ArrayBuffer(iv.length));
  ivAb.set(iv);
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      vaultDekWrapped: wrappedAb,
      vaultDekNonce: ivAb,
      vaultEnabledAt: new Date(),
    },
  });
  return dek;
}

function encryptForDek(dek: Buffer, plaintext: string) {
  const { ciphertext, iv, tag } = encryptGcm(Buffer.from(plaintext, "utf8"), dek);
  return {
    secretCiphertext: ciphertext.toString("base64"),
    secretIv: iv.toString("base64"),
    secretAuthTag: tag.toString("base64"),
  };
}

// Random-looking but obviously-fake password generator for the demo —
// realistic length + symbols, but the seed deliberately avoids
// anything that could be confused with real production secrets.
function fakePassword(prefix = "demo"): string {
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const SYMBOLS = "!@#$%^&*-_=+";
  let s = `${prefix}-`;
  const bytes = randomBytes(22);
  for (let i = 0; i < 18; i++) s += ALPHA[bytes[i] % ALPHA.length];
  s += SYMBOLS[bytes[18] % SYMBOLS.length];
  for (let i = 19; i < 22; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return s;
}

// ─── Seed data ─────────────────────────────────────────────────────────

type SeedEntry = {
  name: string;
  platform: string;
  websiteUrl: string;
  username: string;
  password?: string;          // if absent, generated
  notes?: string;
  // null → org-wide; string → match property by slug
  propertySlug: string | null;
  expiresAt?: Date;
};

const SEED: SeedEntry[] = [
  // ─── Org-wide platform credentials ────────────────────────────────
  {
    name: "Google Workspace — Telegraph Commons admin",
    platform: "google-workspace",
    websiteUrl: "https://admin.google.com",
    username: "admin@telegraphcommons.com",
    notes: "Master admin login. MFA via Yubikey #1 (stored in office safe).",
    propertySlug: null,
  },
  {
    name: "AppFolio Property Manager Plus",
    platform: "appfolio",
    websiteUrl: "https://sgrealestate.appfolio.com",
    username: "norman@sgre.com",
    notes: "REST API: clientId + clientSecret in Settings → Integrations. Phone-MFA bound to 415-555-0199.",
    propertySlug: null,
  },
  {
    name: "Stripe — production dashboard",
    platform: "stripe",
    websiteUrl: "https://dashboard.stripe.com",
    username: "billing@telegraphcommons.com",
    notes: "Restricted-key for the LeaseStack integration is in Settings → Developers. Do NOT rotate without warning the eng team.",
    propertySlug: null,
  },
  {
    name: "Resend — transactional email",
    platform: "resend",
    websiteUrl: "https://resend.com/login",
    username: "billing@telegraphcommons.com",
    notes: "API key for sgrealestate.com domain. Domain verified May 2026.",
    propertySlug: null,
  },
  {
    name: "Bank of America — business operating account",
    platform: "banking",
    websiteUrl: "https://business.bankofamerica.com",
    username: "tc-treasurer",
    notes: "Wires require 2-of-3 approval. Adam, Norman, and bookkeeper Jessica have signing rights.",
    propertySlug: null,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  },
  {
    name: "ADP RUN — payroll",
    platform: "payroll",
    websiteUrl: "https://workforcenow.adp.com",
    username: "norman.gensinger",
    notes: "Payroll runs every other Friday. Quarter-end tax filings auto-handled by ADP.",
    propertySlug: null,
  },
  {
    name: "Notion — operations workspace",
    platform: "notion",
    websiteUrl: "https://notion.so",
    username: "operations@telegraphcommons.com",
    notes: "Workspace admin. Member invites go through this account.",
    propertySlug: null,
  },
  {
    name: "Slack — telegraph-commons.slack.com workspace",
    platform: "slack",
    websiteUrl: "https://telegraph-commons.slack.com",
    username: "admin@telegraphcommons.com",
    notes: "Primary workspace owner. SCIM provisioning via Google Workspace.",
    propertySlug: null,
  },

  // ─── Per-property credentials — Westbrook Commons ──────────────────
  {
    name: "Google Analytics 4 — Westbrook Commons",
    platform: "google-analytics-4",
    websiteUrl: "https://analytics.google.com",
    username: "marketing@telegraphcommons.com",
    notes: "GA4 property ID: 412334782. Service account email: leasestack-ga4@telegraph-commons.iam.gserviceaccount.com (Viewer role on this property only).",
    propertySlug: "westbrook-commons",
  },
  {
    name: "Google Search Console — westbrookcommons.com",
    platform: "google-search-console",
    websiteUrl: "https://search.google.com/search-console",
    username: "marketing@telegraphcommons.com",
    notes: "Domain property verified via DNS TXT. Service account access granted as Viewer for the LeaseStack SEO module.",
    propertySlug: "westbrook-commons",
  },
  {
    name: "Apartments.com listing — Westbrook Commons",
    platform: "apartments-com",
    websiteUrl: "https://manage.apartments.com",
    username: "leasing-westbrook@telegraphcommons.com",
    notes: "Listing renewed annually in November. Auto-renew toggled on.",
    propertySlug: "westbrook-commons",
  },
  {
    name: "Zillow Rental Manager — Westbrook Commons",
    platform: "zillow",
    websiteUrl: "https://www.zillow.com/rental-manager",
    username: "leasing-westbrook@telegraphcommons.com",
    propertySlug: "westbrook-commons",
  },

  // ─── Per-property credentials — Park & Pearl ────────────────────────
  {
    name: "Google Analytics 4 — Park & Pearl",
    platform: "google-analytics-4",
    websiteUrl: "https://analytics.google.com",
    username: "marketing@telegraphcommons.com",
    notes: "GA4 property ID: 412334821.",
    propertySlug: "park-and-pearl",
  },
  {
    name: "Meta Business Manager — Park & Pearl",
    platform: "meta-ads",
    websiteUrl: "https://business.facebook.com",
    username: "ads@telegraphcommons.com",
    notes: "Ad account ID: act_8821934721. System-user token rotates every 60 days.",
    propertySlug: "park-and-pearl",
    expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Apartments.com listing — Park & Pearl",
    platform: "apartments-com",
    websiteUrl: "https://manage.apartments.com",
    username: "leasing-parkpearl@telegraphcommons.com",
    propertySlug: "park-and-pearl",
  },

  // ─── Per-property credentials — Sage at Greenpoint ──────────────────
  {
    name: "Google Analytics 4 — Sage at Greenpoint",
    platform: "google-analytics-4",
    websiteUrl: "https://analytics.google.com",
    username: "marketing@telegraphcommons.com",
    notes: "GA4 property ID: 412334899.",
    propertySlug: "sage-at-greenpoint",
  },
  {
    name: "Google Ads — Sage at Greenpoint",
    platform: "google-ads",
    websiteUrl: "https://ads.google.com",
    username: "ads@telegraphcommons.com",
    notes: "Customer ID: 728-441-9203. Linked to Telegraph Commons MCC.",
    propertySlug: "sage-at-greenpoint",
  },
  {
    name: "Zillow Rental Manager — Sage at Greenpoint",
    platform: "zillow",
    websiteUrl: "https://www.zillow.com/rental-manager",
    username: "leasing-sage@telegraphcommons.com",
    propertySlug: "sage-at-greenpoint",
  },

  // ─── Per-property credentials — The Rhodes ─────────────────────────
  {
    name: "Google Analytics 4 — The Rhodes",
    platform: "google-analytics-4",
    websiteUrl: "https://analytics.google.com",
    username: "marketing@telegraphcommons.com",
    notes: "GA4 property ID: 412334952.",
    propertySlug: "the-rhodes",
  },
  {
    name: "Mailchimp — The Rhodes resident newsletter",
    platform: "mailchimp",
    websiteUrl: "https://login.mailchimp.com",
    username: "newsletter@telegraphcommons.com",
    notes: "Monthly newsletter to 384 current residents. Audience ID: f2ab19d0c.",
    propertySlug: "the-rhodes",
  },
  {
    name: "Apartments.com listing — The Rhodes",
    platform: "apartments-com",
    websiteUrl: "https://manage.apartments.com",
    username: "leasing-rhodes@telegraphcommons.com",
    propertySlug: "the-rhodes",
  },
];

async function main() {
  console.log(`[vault-seed] resolving demo org ${DEMO_ORG_SLUG}…`);
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true, name: true, moduleVault: true },
  });
  if (!org) {
    console.error(`[vault-seed] org "${DEMO_ORG_SLUG}" not found.`);
    process.exit(1);
  }
  console.log(`[vault-seed] org: ${org.name} (${org.id})`);

  // Enable the module.
  await prisma.organization.update({
    where: { id: org.id },
    data: { moduleVault: true },
  });
  console.log("[vault-seed] moduleVault enabled");

  // Resolve / mint the org's DEK using the master KEK in env.
  const dek = await getOrMintOrgDek(org.id);
  console.log("[vault-seed] org DEK ready");

  // Resolve property slugs → ids
  const properties = await prisma.property.findMany({
    where: { orgId: org.id },
    select: { id: true, slug: true },
  });
  const propIdBySlug = new Map<string, string>();
  for (const p of properties) {
    if (p.slug) propIdBySlug.set(p.slug, p.id);
  }
  console.log(`[vault-seed] resolved ${propIdBySlug.size} properties`);

  // Idempotent wipe of prior seed rows tagged with our sentinel.
  const wiped = await prisma.credentialEntry.deleteMany({
    where: { orgId: org.id, tags: { has: SEED_TAG } },
  });
  console.log(`[vault-seed] cleared ${wiped.count} prior seed rows`);

  // Insert fresh seed rows.
  let inserted = 0;
  for (const s of SEED) {
    const propertyId = s.propertySlug ? propIdBySlug.get(s.propertySlug) ?? null : null;
    if (s.propertySlug && !propertyId) {
      console.warn(`[vault-seed] property slug "${s.propertySlug}" not found, skipping ${s.name}`);
      continue;
    }
    const password = s.password ?? fakePassword();
    const enc = encryptForDek(dek, password);
    await prisma.credentialEntry.create({
      data: {
        orgId: org.id,
        propertyId,
        name: s.name,
        platform: s.platform,
        websiteUrl: s.websiteUrl,
        username: s.username,
        notes: s.notes ?? null,
        tags: [SEED_TAG],
        secretCiphertext: enc.secretCiphertext,
        secretIv: enc.secretIv,
        secretAuthTag: enc.secretAuthTag,
        lastRotatedAt: new Date(),
        expiresAt: s.expiresAt ?? null,
      },
    });
    inserted += 1;
  }
  console.log(`[vault-seed] inserted ${inserted} credentials`);

  // Add a handful of access-log entries so the UI's "X reveals in last
  // 24h" KPI shows something meaningful on the demo screenshot.
  const fewCreds = await prisma.credentialEntry.findMany({
    where: { orgId: org.id, tags: { has: SEED_TAG } },
    select: { id: true },
    take: 4,
  });
  for (const c of fewCreds) {
    await prisma.credentialAccessLog.create({
      data: {
        credentialId: c.id,
        orgId: org.id,
        userId: null,
        userEmail: "norman@sgre.com",
        action: "reveal",
        ipAddress: "73.158.144.21",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
        occurredAt: new Date(Date.now() - Math.random() * 22 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`[vault-seed] seeded ${fewCreds.length} demo access-log entries`);

  await prisma.$disconnect();
  console.log("[vault-seed] done.");
}

main().catch(async (err) => {
  console.error("[vault-seed] failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
