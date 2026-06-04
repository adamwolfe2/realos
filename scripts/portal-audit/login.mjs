// One-time headed login using a PERSISTENT browser profile.
//
// Clerk dev mode treats each Playwright context as a new device, so
// the simpler storageState() flow loses the session between runs.
// launchPersistentContext writes cookies into a real on-disk profile
// directory and every subsequent run reuses it.
//
// Usage: node scripts/portal-audit/login.mjs

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const PROFILE_DIR = path.resolve(
  ".claude/audits/2026-06-03-portal/.auth/profile",
);

async function main() {
  await mkdir(PROFILE_DIR, { recursive: true });

  console.log(`Opening browser at ${BASE_URL}/sign-in ...`);
  console.log(
    "Sign in normally. Once you land on /portal AND see the dashboard render, press Enter here.\n",
  );

  const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: isLocal
      ? [
          "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
        ]
      : [],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${BASE_URL}/sign-in`);

  // Wait for the user to sign in manually, then press Enter in this terminal.
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve(undefined));
  });

  console.log(`\nProfile persisted at ${PROFILE_DIR}`);
  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
