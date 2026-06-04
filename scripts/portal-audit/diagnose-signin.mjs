// Deep diagnose prod /sign-in render. Simulates a real-user Chrome
// (not headless-flagged), waits long enough for Clerk to fully
// hydrate, captures everything: console errors, network failures,
// blocked requests, DOM state, final visual.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(".claude/audits/2026-06-03-portal/screenshots/iteration");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  const events = { pageerror: [], console: [], requestfailed: [], blocked: [] };
  page.on("pageerror", (e) => events.pageerror.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      events.console.push(`[${m.type()}] ${m.text()}`);
    }
  });
  page.on("requestfailed", (r) =>
    events.requestfailed.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`),
  );
  page.on("response", async (r) => {
    if (r.status() >= 400) {
      events.blocked.push(`${r.status()} ${r.url()}`);
    }
  });

  const resp = await page.goto("https://www.leasestack.co/sign-in", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  // Long wait — let Clerk's full network round-trip happen
  await page.waitForTimeout(8000);

  const file = path.join(OUT, "prod-signin-deep.png");
  await page.screenshot({ path: file, fullPage: true });

  const dom = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const all = (s) => document.querySelectorAll(s);
    return {
      title: document.title,
      url: location.href,
      clerkScriptTag: !!q("script[src*='clerk']"),
      clerkScriptSrc: q("script[src*='clerk']")?.getAttribute("src") || null,
      clerkLoaded: !!window.Clerk,
      clerkLoadedReady: window.Clerk?.loaded || false,
      clerkUser: !!window.Clerk?.user,
      clRootBox: !!q(".cl-rootBox"),
      clCard: !!q(".cl-card"),
      clFormButton: !!q(".cl-formButtonPrimary"),
      emailInput: !!q('input[name="identifier"], input[type="email"]'),
      passwordInput: !!q('input[type="password"]'),
      allClerkEls: all("[class*='cl-']").length,
      allInputs: all("input").length,
      visibleHeadings: Array.from(all("h1,h2,h3"))
        .map((h) => h.textContent?.trim().slice(0, 60))
        .filter(Boolean),
      hasInviteCopy: document.body.innerText.includes("Were you invited"),
      bodyTextLength: document.body.innerText.length,
      finalBodyPreview: document.body.innerText.slice(0, 800),
    };
  });

  console.log(
    JSON.stringify(
      {
        status: resp?.status(),
        finalUrl: page.url(),
        dom,
        events: {
          pageerror: events.pageerror,
          console: events.console.slice(0, 25),
          requestfailed: events.requestfailed,
          blocked4xx5xx: events.blocked.slice(0, 25),
        },
        file,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
