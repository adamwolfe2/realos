// Impersonate target tenant + capture a single route. For iteration
// after applying a fix to an operator-facing page.
//
// Usage:
//   AUDIT_BASE_URL=https://leasestack.co \
//   node scripts/portal-audit/capture-one-as-tenant.mjs /portal/leads leads_AFTER

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "https://leasestack.co";
const TENANT_HINT = process.env.AUDIT_TENANT_HINT || "Telegraph";
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

  await page.goto(`${BASE_URL}/admin/clients`, { waitUntil: "networkidle" });
  if (/\/sign-in/.test(page.url())) {
    console.error("AUTH LOST — re-run login.mjs");
    await context.close();
    process.exit(2);
  }

  const orgId = await page.evaluate((hint) => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/admin/clients/']"));
    for (const a of anchors) {
      const m = a.getAttribute("href")?.match(/\/admin\/clients\/([^/?#]+)/);
      if (!m) continue;
      let el = a;
      for (let i = 0; i < 6 && el; i++) {
        if ((el.textContent || "").toLowerCase().includes(hint.toLowerCase())) {
          return m[1];
        }
        el = el.parentElement;
      }
    }
    return null;
  }, TENANT_HINT);

  if (!orgId) {
    console.error(`No tenant matching '${TENANT_HINT}'`);
    await context.close();
    process.exit(3);
  }

  const start = await page.evaluate(async (id) => {
    const r = await fetch("/api/admin/impersonate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: id }),
    });
    return r.status;
  }, orgId);
  if (start !== 200) {
    console.error(`Impersonation failed: ${start}`);
    await context.close();
    process.exit(4);
  }
  await page.waitForTimeout(1500);

  const file = path.join(OUT_DIR, `${name}.png`);
  const t0 = Date.now();
  const res = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${file} (${res?.status()}, ${Date.now() - t0}ms)`);

  // Clean up: end impersonation
  await page.evaluate(async () => {
    await fetch("/api/admin/impersonate/end", { method: "POST" });
  });
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
