import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Load .env.local so DATABASE_URL + Clerk keys are available to globalSetup
// and the dev server. Playwright doesn't read .env files automatically.
loadEnv({ path: path.resolve(__dirname, ".env.local") });
loadEnv({ path: path.resolve(__dirname, ".env") });

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
  // hostname (telegraph-commons.realestaite.co) resolve to the local dev
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
                "--host-resolver-rules=MAP *.realestaite.co 127.0.0.1, MAP realestaite.co 127.0.0.1",
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
                "--host-resolver-rules=MAP *.realestaite.co 127.0.0.1, MAP realestaite.co 127.0.0.1",
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
