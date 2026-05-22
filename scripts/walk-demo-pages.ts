import { chromium } from "playwright";

const PAGES = [
  "https://www.leasestack.co/",
  "https://www.leasestack.co/sign-in",
  "https://www.telegraphcommons.com/",
  "https://www.telegraphcommons.com/availability",
  "https://www.telegraphcommons.com/floor-plans",
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const url of PAGES) {
    const errors: string[] = [];
    const consoleErrs: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") consoleErrs.push(m.text()); });
    const start = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const elapsed = Date.now() - start;
      const status = resp?.status() ?? 0;
      const titleText = await page.title();
      console.log(`✓ ${url}\n  status=${status}  time=${elapsed}ms  title="${titleText.slice(0, 60)}"`);
      if (errors.length) console.log(`  ⚠ ${errors.length} pageerror(s): ${errors.slice(0,2).join(" | ")}`);
      if (consoleErrs.length) console.log(`  ⚠ ${consoleErrs.length} console error(s): ${consoleErrs.slice(0,2).map(e => e.slice(0, 100)).join(" | ")}`);
    } catch (e) {
      console.log(`✗ ${url}\n  failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await browser.close();
})();
