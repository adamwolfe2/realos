// Headless screenshot capture across every portal route.
//
// Reuses the persistent profile from login.mjs so the Clerk session
// survives. Writes full-page PNGs to screenshots/<group>/<slug>.png
// plus a JSON manifest with status + render time per route.
//
// Usage: node scripts/portal-audit/capture.mjs

import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const ROOT = path.resolve(".claude/audits/2026-06-03-portal");
const PROFILE_DIR = path.join(ROOT, ".auth/profile");
const ROUTES_PATH = path.join(ROOT, "routes.json");
const SHOT_DIR = path.join(ROOT, "screenshots");
const MANIFEST_PATH = path.join(ROOT, "capture-manifest.json");

const VIEWPORTS = [{ name: "desktop", width: 1440, height: 900 }];

function slugify(s) {
  return s.replace(/^\//, "").replace(/[\/ &]+/g, "_") || "root";
}

async function main() {
  const routesJson = JSON.parse(await readFile(ROUTES_PATH, "utf8"));
  const manifest = { startedAt: new Date().toISOString(), results: [] };

  const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);
  for (const viewport of VIEWPORTS) {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: viewport.width, height: viewport.height },
      args: isLocal
        ? [
            "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
          ]
        : [],
    });
    const page = context.pages()[0] ?? (await context.newPage());

    // Sanity check — hit /portal first and bail loudly if we see the
    // sign-in page. Saves writing 50 useless screenshots.
    await page.goto(`${BASE_URL}/portal`, { waitUntil: "networkidle" });
    const url = page.url();
    if (/\/sign-in/.test(url)) {
      console.error(
        `\nERROR: redirected to ${url} — Clerk session not active. Re-run login.mjs.`,
      );
      await context.close();
      process.exit(2);
    }

    for (const group of routesJson.groups) {
      const groupDir = path.join(SHOT_DIR, viewport.name, slugify(group.name));
      await mkdir(groupDir, { recursive: true });

      for (const route of group.routes) {
        const slug = slugify(route);
        const file = path.join(groupDir, `${slug}.png`);
        const t0 = Date.now();
        let status = "ok";
        let httpStatus = 0;
        let title = "";
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
            title = await page.title();
            await page.screenshot({ path: file, fullPage: true });
          }
        } catch (err) {
          status = "error";
          error = err.message;
        }

        const ms = Date.now() - t0;
        const result = {
          group: group.name,
          route,
          viewport: viewport.name,
          file: path.relative(ROOT, file),
          httpStatus,
          title,
          status,
          error,
          finalUrl,
          ms,
        };
        manifest.results.push(result);
        const tag =
          status === "ok" ? "OK" : status === "auth-lost" ? "AUTH" : "ERR";
        console.log(
          `[${tag}] ${viewport.name} ${route} (${httpStatus}, ${ms}ms)${
            error ? " — " + error : ""
          }`,
        );
      }
    }

    await context.close();
  }

  manifest.finishedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
