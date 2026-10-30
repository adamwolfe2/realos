#!/usr/bin/env node
// Screenshot every route on two running builds (before / after a font change)
// back to back, for scripts/fonts/compare.py to pixel-diff.
// Usage: node scripts/fonts/pixel-diff.mjs <beforeUrl> <afterUrl> <outDir> [routesFile]
// outDir must be new or empty so compare.py never sees screenshots from an older run.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";

const [before, after, outDir, routesFile = "scripts/fonts/routes.txt"] = process.argv.slice(2);
if (!before || !after || !outDir) {
  console.error("usage: pixel-diff.mjs <beforeUrl> <afterUrl> <outDir> [routesFile]");
  process.exit(1);
}
if (existsSync(outDir) && readdirSync(outDir).length) {
  console.error(`${outDir} is not empty; use a fresh directory`);
  process.exit(1);
}
const routes = readFileSync(routesFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
mkdirSync(outDir, { recursive: true });

async function shoot(browser, url, file, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    if (!res?.ok()) throw new Error(`HTTP ${res?.status()} for ${url}`);
    // Walk the page so in-view animations settle, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "hide" });
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
let failed = 0;
for (const route of routes) {
  const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "_");
  for (const [vp, viewport] of Object.entries(viewports)) {
    try {
      await shoot(browser, before + route, `${outDir}/${slug}.${vp}.before.png`, viewport);
      await shoot(browser, after + route, `${outDir}/${slug}.${vp}.after.png`, viewport);
      console.log(route, vp, "ok");
    } catch (err) {
      failed++;
      console.error(route, vp, "FAILED", err.message);
    }
  }
}
await browser.close();
if (failed) {
  console.error(`${failed} capture(s) failed`);
  process.exit(1);
}
