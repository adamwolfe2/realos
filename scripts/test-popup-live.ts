import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Capture every console message + every network request
  const consoleLogs: string[] = [];
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("console", (m) => consoleLogs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("leasestack") || u.includes("popup")) requests.push(`${r.method()} ${u}`);
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("popup")) consoleLogs.push(`HTTP ${r.status()} ${u}`);
  });

  console.log("Loading https://www.telegraphcommons.com/ ...");
  await page.goto("https://www.telegraphcommons.com/", { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait 12 seconds — 8s trigger + buffer
  console.log("Waiting 12s for TIME_ON_PAGE trigger to fire...");
  await page.waitForTimeout(12000);

  // Check if popup is in DOM
  const hasPopupRoot = await page.evaluate(() => {
    return {
      hasRoot: document.querySelectorAll('.ls-popup-root, [class*="leasestack-popup"], [id*="leasestack"]').length,
      hasStyles: !!document.getElementById("leasestack-popup-style"),
      hasGlobal: (window as any).__leasestackPopupLoaded === true,
      sidStored: sessionStorage.getItem("leasestack.popup.sid"),
      shownKeys: Object.keys(sessionStorage).filter(k => k.includes("leasestack.popup.shown")),
      scripts: Array.from(document.querySelectorAll('script[src*="popup"]')).map(s => (s as HTMLScriptElement).src),
    };
  });

  console.log("\nNetwork (popup-related):");
  requests.forEach(r => console.log(`  ${r}`));

  console.log("\nConsole logs:");
  consoleLogs.forEach(l => console.log(`  ${l}`));

  if (errors.length) {
    console.log("\nPage errors:");
    errors.forEach(e => console.log(`  ${e}`));
  }

  console.log("\nDOM probe:");
  console.log(JSON.stringify(hasPopupRoot, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
