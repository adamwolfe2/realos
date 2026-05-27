import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { createHmac } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Drives the 5-step marketplace seller import wizard and screenshots each
// step into docs/screenshots/import-wizard/. Run with:
//
//   pnpm playwright test e2e/marketplace-import-wizard.spec.ts
//
// Seeds a throwaway seller via the DB + mints a signed session cookie so the
// auth gate at /marketplace/seller/import passes without a real magic-link
// roundtrip.
// ---------------------------------------------------------------------------

const TEST_EMAIL = "screenshot-test@example.com";
const SHOTS_DIR = join(process.cwd(), "docs", "screenshots", "import-wizard");

const SAMPLE_CSV = `First Name,Last Name,Email,Phone,City,State,Zip,Property Type,Notes,Move Timeline,Listings Viewed,Pre Approved
Marisol,Reyes,m.reyes@example.com,(917) 555-0142,Brooklyn,NY,11215,SALE,Viewed 23 listings,0-30 days,23,Yes
Derek,Chen,derek.chen@example.com,+1-305-555-0118,Miami,FL,33139,SALE,Mortgage pre-app,30-60 days,11,Yes
Aisha,Salinas,aisha.s@example.com,310.555.0377,Los Angeles,CA,90048,RENTAL,5 tours scheduled,0-14 days,18,No
Tyler,Grant,tyler.g@example.com,5125550289,Austin,TX,78704,INVESTMENT,Cash buyer signal,0-45 days,8,No
Rohan,Nair,rohan.n@example.com,617-555-0450,Boston,MA,02116,SALE,Relocation,30-90 days,6,No
Lena,Park,lena.park@example.com,2065550199,Seattle,WA,98101,SALE,Relocation - job,30 days,9,No
Jamal,Wright,jw@example.com,(404) 555-0277,Atlanta,GA,30309,SALE,Cash buyer,asap,15,No
Sofia,Garcia,sofia.g@example.com,7035550388,Arlington,VA,22201,RENTAL,Move in 60 days,30-60 days,5,No
`;

let prisma: PrismaClient;
let sellerId: string;
let sessionCookie: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  const adapter = new PrismaNeonHttp(dbUrl, {} as never);
  prisma = new PrismaClient({ adapter });
  await mkdir(SHOTS_DIR, { recursive: true });

  // Clean slate — drop any existing leads from this test seller so the
  // dedup preview always starts predictable. (Neon HTTP doesn't support
  // transactions, so we use individual queries instead of upserts.)
  let seller = await prisma.marketplaceSeller.findUnique({
    where: { email: TEST_EMAIL },
  });
  if (seller) {
    await prisma.marketplaceLead.deleteMany({ where: { sellerId: seller.id } });
  } else {
    seller = await prisma.marketplaceSeller.create({
      data: { email: TEST_EMAIL, revShareBps: 7000 },
    });
  }
  sellerId = seller.id;

  // Pre-seed ONE lead so the dedup step has something to compare against —
  // Derek Chen is in the CSV, so this triggers exact-match in the preview.
  const source = await prisma.marketplaceSyncSource.create({
    data: {
      name: "Screenshot test source",
      kind: "MANUAL",
      externalId: `screenshot-test-${Date.now()}`,
      defaultPropertyType: "SALE",
      defaultMarket: "United States",
      minScoreFloor: 40,
      baselineScore: 60,
      defaultPriceCents: 5000,
      enabled: true,
    },
  });
  await prisma.marketplaceLead.create({
    data: {
      sourceId: source.id,
      sellerId: seller.id,
      cursiveProfileId: `screenshot-test-derek-${Date.now()}`,
      firstName: "Derek",
      lastName: "Chen",
      email: "derek.chen@example.com",
      phone: "+13055550118",
      city: "Miami",
      state: "FL",
      postalCode: "33139",
      market: "Miami",
      propertyType: "SALE",
      intentScore: 75,
      priceCents: 5000,
      status: "AVAILABLE",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // Mint a session cookie value. The secret is loaded by playwright.config.ts
  // (which checks .env.local, .env, .env.production.local in priority order,
  // and falls back to a deterministic test-only value if none are set). The
  // dev server inherits the same process env, so the spec's HMAC and the
  // server's verification HMAC use the same key.
  const secret =
    process.env.MARKETPLACE_AUTH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Marketplace HMAC secret not configured. Expected MARKETPLACE_AUTH_SECRET " +
        "or ENCRYPTION_KEY in .env.local / .env.production.local (playwright.config.ts " +
        "sets a test-only fallback when neither is present).",
    );
  }
  const issuedAt = Date.now();
  const payload = `${seller.id}.${issuedAt}`;
  const sig = createHmac("sha256", `seller:${secret}`)
    .update(payload)
    .digest("hex");
  sessionCookie = `${payload}.${sig}`;
});

test.afterAll(async () => {
  await prisma.marketplaceLead.deleteMany({ where: { sellerId } });
  await prisma.marketplaceSyncSource.deleteMany({
    where: { name: "Screenshot test source" },
  });
  await prisma.$disconnect();
});

test("drives the wizard through all 5 steps + screenshots each", async ({
  page,
  context,
}) => {
  // Inject the session cookie before navigating.
  await context.addCookies([
    {
      name: "ls_marketplace_seller_session",
      value: sessionCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Step 1 — Source picker
  await page.goto("/marketplace/seller/import");
  await expect(page.getByText("Choose source")).toBeVisible();
  await screenshot(page, "01-step-source.png");

  await page.getByText("CSV upload", { exact: false }).first().click();

  // Step 2 — Upload
  await expect(page.getByText("Upload your CSV")).toBeVisible();
  const csvPath = join(SHOTS_DIR, "_sample.csv");
  await writeFile(csvPath, SAMPLE_CSV);
  await page.setInputFiles('input[type="file"]', csvPath);
  await expect(page.getByText(/rows parsed/)).toBeVisible({ timeout: 10_000 });
  await screenshot(page, "02-step-upload.png");
  await page.getByRole("button", { name: /Next/ }).click();

  // Step 3 — Map columns
  await expect(page.getByText("Map your columns")).toBeVisible();
  await page.waitForTimeout(300); // settle hover states for screenshot
  await screenshot(page, "03-step-map.png");
  await page.getByRole("button", { name: /Next/ }).click();

  // Step 4 — Dedup preview
  await expect(page.getByText("Deduplication preview")).toBeVisible({
    timeout: 15_000,
  });
  // Wait until the preview finishes loading.
  await expect(page.getByText(/New$|New records/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
  await screenshot(page, "04-step-dedup.png");

  // Final commit — click "Import data →".
  await page.getByRole("button", { name: /Import data/ }).click();

  // Step 5 — Summary
  await expect(page.getByText("Import complete")).toBeVisible({
    timeout: 15_000,
  });
  await screenshot(page, "05-step-import-complete.png");
});

async function screenshot(page: Page, filename: string) {
  await page.screenshot({
    path: join(SHOTS_DIR, filename),
    fullPage: true,
  });
}
