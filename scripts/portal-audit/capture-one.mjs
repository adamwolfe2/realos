// Capture a single route for fast iteration after a change.
// Reuses the persistent profile from login.mjs.
//
// Usage: node scripts/portal-audit/capture-one.mjs /portal [name]

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const ROOT = path.resolve(".claude/audits/2026-06-03-portal");
const PROFILE_DIR = path.join(ROOT, ".auth/profile");
const OUT_DIR = path.join(ROOT, "screenshots/iteration");

async function main() {
  const route = process.argv[2] || "/portal";
  const name =
    process.argv[3] ||
    `${route.replace(/^\//, "").replace(/\//g, "_")}_${Date.now()}`;
  await mkdir(OUT_DIR, { recursive: true });

  const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: isLocal
      ? [
          "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
        ]
      : [],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const file = path.join(OUT_DIR, `${name}.png`);
  const t0 = Date.now();
  const res = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  const finalUrl = page.url();
  if (/\/sign-in/.test(finalUrl)) {
    console.error(`AUTH LOST — redirected to ${finalUrl}. Re-run login.mjs.`);
    await context.close();
    process.exit(2);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${file} (${res?.status()}, ${Date.now() - t0}ms)`);
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
