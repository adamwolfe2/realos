// Capture public marketing pages. No auth required.
//
// Usage: AUDIT_BASE_URL=https://leasestack.co node scripts/portal-audit/capture-marketing.mjs

import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "https://leasestack.co";
const ROOT = path.resolve(".claude/audits/2026-06-03-portal");
const ROUTES_PATH = path.join(ROOT, "marketing-routes.json");
const SHOT_DIR = path.join(ROOT, "screenshots-marketing");
const MANIFEST_PATH = path.join(ROOT, "marketing-capture-manifest.json");

function slugify(s) {
  return s.replace(/^\//, "").replace(/[\/ &]+/g, "_") || "root";
}

async function main() {
  const routesJson = JSON.parse(await readFile(ROUTES_PATH, "utf8"));
  const manifest = { startedAt: new Date().toISOString(), results: [] };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

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
      let title = "";

      try {
        const response = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        httpStatus = response?.status() ?? 0;
        await page.waitForTimeout(1200);
        title = await page.title();
        await page.screenshot({ path: file, fullPage: true });
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
        title,
        status,
        error,
        ms,
      });
      console.log(
        `[${status === "ok" ? "OK" : "ERR"}] ${route} (${httpStatus}, ${ms}ms)${error ? " — " + error : ""}`,
      );
    }
  }

  manifest.finishedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
