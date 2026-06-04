// Capture all admin routes as the agency super-admin (no impersonation).
// Persistent profile is logged in as Adam, who has /admin access.
//
// Usage: AUDIT_BASE_URL=https://leasestack.co node scripts/portal-audit/capture-admin.mjs

import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "https://leasestack.co";
const ROOT = path.resolve(".claude/audits/2026-06-03-portal");
const PROFILE_DIR = path.join(ROOT, ".auth/profile");
const ROUTES_PATH = path.join(ROOT, "admin-routes.json");
const SHOT_DIR = path.join(ROOT, "screenshots-admin");
const MANIFEST_PATH = path.join(ROOT, "admin-capture-manifest.json");

function slugify(s) {
  return s.replace(/^\//, "").replace(/[\/ &]+/g, "_") || "root";
}

async function main() {
  const routesJson = JSON.parse(await readFile(ROUTES_PATH, "utf8"));
  const manifest = { startedAt: new Date().toISOString(), results: [] };

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

  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  if (/\/sign-in/.test(page.url())) {
    console.error("AUTH LOST — re-run login.mjs");
    await context.close();
    process.exit(2);
  }

  for (const group of routesJson.groups) {
    const groupDir = path.join(SHOT_DIR, slugify(group.name));
    await mkdir(groupDir, { recursive: true });

    for (const route of group.routes) {
      const slug = slugify(route);
      const file = path.join(groupDir, `${slug}.png`);
      const t0 = Date.now();
      let status = "ok";
      let httpStatus = 0;
      let error = null;
      let finalUrl = "";

      try {
        const response = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        httpStatus = response?.status() ?? 0;
        finalUrl = page.url();
        if (/\/sign-in/.test(finalUrl)) {
          status = "auth-lost";
        } else {
          await page.waitForTimeout(800);
          await page.screenshot({ path: file, fullPage: true });
        }
      } catch (err) {
        status = "error";
        error = err.message;
      }

      const ms = Date.now() - t0;
      manifest.results.push({
        group: group.name,
        route,
        file: path.relative(ROOT, file),
        httpStatus,
        status,
        error,
        finalUrl,
        ms,
      });
      const tag =
        status === "ok" ? "OK" : status === "auth-lost" ? "AUTH" : "ERR";
      console.log(
        `[${tag}] ${route} (${httpStatus}, ${ms}ms)${error ? " — " + error : ""}`,
      );
    }
  }

  manifest.finishedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST_PATH}`);
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
