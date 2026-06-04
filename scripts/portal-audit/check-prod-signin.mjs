// Verify prod /sign-in actually renders the Clerk SignIn form after JS hydration.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(".claude/audits/2026-06-03-portal/screenshots/iteration");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Listen for console errors
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });

  await page.goto("https://www.leasestack.co/sign-in", {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await page.waitForTimeout(3000); // let Clerk hydrate

  const file = path.join(OUT, "prod-signin.png");
  await page.screenshot({ path: file, fullPage: true });

  const findings = await page.evaluate(() => {
    const cl = document.querySelector("[data-clerk-loaded], .cl-rootBox, .cl-signIn-root");
    const allClerkEls = document.querySelectorAll("[class*='cl-']");
    const emailInput = document.querySelector('input[type="email"], input[name="identifier"]');
    const continueBtn = Array.from(document.querySelectorAll("button"))
      .find((b) => /continue|sign in|next/i.test(b.textContent || ""));
    return {
      clerkRootFound: !!cl,
      clerkElementCount: allClerkEls.length,
      hasEmailInput: !!emailInput,
      hasContinueButton: !!continueBtn,
      bodyTextSample: document.body.innerText.slice(0, 500),
    };
  });

  console.log(JSON.stringify({ file, findings, errors }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
