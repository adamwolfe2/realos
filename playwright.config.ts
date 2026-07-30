import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Load env files so DATABASE_URL + Clerk + marketplace HMAC secrets are
// available to globalSetup, the spawned dev server (it inherits this
// process's env), and individual specs that mint signed cookies.
//
// Precedence — first one wins for each key (dotenv default is no-override):
//   .env.local        — local dev primary
//   .env              — committed defaults
//   .env.production.local — fallback for secrets that aren't checked into
//     .env.local (e.g. ENCRYPTION_KEY, MARKETPLACE_AUTH_SECRET). Without
//     this, specs that need the same HMAC key the prod server uses can't
//     mint a valid session cookie.
loadEnv({ path: path.resolve(__dirname, ".env.local") });
loadEnv({ path: path.resolve(__dirname, ".env") });
loadEnv({ path: path.resolve(__dirname, ".env.production.local") });

// CI safety net: if still no marketplace HMAC secret is available (the .env
// files don't ship one, e.g. in a fresh clone or in GitHub Actions), set a
// deterministic test-only value so the spec + dev server agree on what to
// sign cookies with. Test-only — never used in real environments.
if (
  !process.env.MARKETPLACE_AUTH_SECRET &&
  (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32)
) {
  process.env.MARKETPLACE_AUTH_SECRET =
    "test-only-marketplace-auth-secret-32-bytes-min-do-not-use-in-prod";
}

// One server, one auth mode. Default: demo mode (DEMO_MODE=true,
// DEMO_TARGET=client) so authed /portal specs exercise the seeded demo org
// through the same bypass prospects use — hard-disabled in production
// (lib/tenancy/scope.ts). Set E2E_DEMO=false to start a normal server
// instead: the auth-redirect guard specs run, authed portal specs skip.
// The spawned dev server inherits this process's env (see dotenv note above).
export const E2E_DEMO_AUTH = process.env.E2E_DEMO !== "false";
if (E2E_DEMO_AUTH) {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_TARGET = "client";
  // .env.production.local (vercel env pull) carries VERCEL_ENV=production,
  // which trips getDemoScope()'s production hard-disable in the spawned dev
  // server: middleware passes the request through, then getScope() returns
  // null and every portal page 403s. The guard is correct — this local test
  // server just must not masquerade as production.
  delete process.env.VERCEL_ENV;
}

export default defineConfig({
  testDir: "./e2e",
  // Skip the helper / fixture / .cache directories.
  testIgnore: ["**/helpers/**", "**/fixtures/**", "**/.cache/**"],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Local: 1 retry to absorb first-compile flake from Turbopack on cold
  // tenant-site routes. CI: 2 retries.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/helpers/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Default to Chromium only. Add firefox/webkit by setting
  // E2E_ALL_BROWSERS=1, or pass `--project=firefox` directly.
  //
  // We pass --host-resolver-rules so that requests to the seeded tenant
  // hostname (telegraph-commons.leasestack.co) resolve to the local dev
  // server. Chromium refuses to honor a manually-set Host header for
  // security reasons, so DNS-style remapping is the only clean way to
  // exercise the tenant middleware end-to-end without running the prod
  // platform domain.
  projects: process.env.E2E_ALL_BROWSERS
    ? [
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
            launchOptions: {
              args: [
                "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
              ],
            },
          },
        },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ]
    : [
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
            launchOptions: {
              args: [
                "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
              ],
            },
          },
        },
      ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
