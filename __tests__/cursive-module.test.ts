import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Structural tests for the Cursive (the upstream pixel provider SuperPixel) module.
// Mirrors __tests__/seo-module.test.ts. Guards three things that
// repeatedly bite us when someone "simplifies" a cron schedule or
// tweaks a stale threshold without realizing the integration depends
// on tight push + pull cadence:
//
//   1. vercel.json keeps the pixel-segment-sync cron at <= 5 min so
//      the worst-case self-heal window doesn't regress to 30 min.
//   2. freshness budget for cursive_pixel stays at 2 min so the
//      stale-on-load trigger keeps firing between cron ticks.
//   3. The one-flow setup pieces (server actions, wizard component,
//      auto-bind logic in the webhook processor) all stay wired.

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("Cursive module — cron + freshness", () => {
  it("vercel.json registers pixel-segment-sync on a tight schedule", () => {
    const vercel = JSON.parse(readFile("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const found = vercel.crons.find(
      (c) => c.path === "/api/cron/pixel-segment-sync",
    );
    expect(found).toBeDefined();
    // Must be at least every 5 minutes. Catches regressions that lift
    // the schedule back to */30 or hourly — operators feel that
    // immediately as 'I keep pressing sync, it's not real-time'.
    expect(found?.schedule).toMatch(/^\*\/(?:1|2|3|5)\s/);
  });

  it("pixel-segment-sync route enforces CRON_SECRET and runs the cursive sync", () => {
    const src = readFile("app/api/cron/pixel-segment-sync/route.ts");
    const hasAuth =
      src.includes("CRON_SECRET") || src.includes("verifyCronAuth");
    expect(hasAuth).toBe(true);
    expect(src).toMatch(/export async function GET/);
    expect(src).toContain("runCursiveSegmentSync");
  });

  it("cursive_pixel freshness budget is tight (<=5 min stale)", async () => {
    const { FRESHNESS_BUDGET } = await import("../lib/sync/freshness");
    const budget = FRESHNESS_BUDGET.cursive_pixel;
    expect(budget).toBeDefined();
    // Tight ceiling so the stale-on-load trigger keeps firing.
    expect(budget.staleAfterMs).toBeLessThanOrEqual(5 * 60 * 1000);
    // Very-stale should still be hours / a day so we don't alarm on
    // pixels that legitimately had a quiet night.
    expect(budget.veryStaleAfterMs).toBeGreaterThanOrEqual(
      60 * 60 * 1000,
    );
  });
});

describe("Cursive module — dual-surface segment pull", () => {
  // 2026-08-16 incident: segments provisioned on AL's newer /audiences
  // (Audience Lists) surface don't exist on /segments — the old
  // single-surface pull either 404'd or, worse, read AL's HTTP-200
  // { status: "NOT_FOUND" } body as an empty segment and reported
  // ok/pulled:0 forever while syncing nothing. These pins keep the
  // sync surface-aware and loud about drift.
  const src = readFile("lib/actions/admin-cursive.ts");

  it("probes both /segments and /audiences surfaces", () => {
    expect(src).toContain('fetchAlSegmentPage("segments"');
    expect(src).toContain('fetchAlSegmentPage("audiences"');
  });

  it("treats AL's HTTP-200 NOT_FOUND body as a miss, never an empty page", () => {
    expect(src).toContain('json.status === "NOT_FOUND"');
  });

  it("reports drift as an error instead of a silent empty success", () => {
    expect(src).toContain(
      "Segment ID not found on Cursive /segments or /audiences",
    );
  });

  it("accepts the /audiences hem field shapes (SHA256_PERSONAL_EMAIL)", () => {
    expect(src).toContain("SHA256_PERSONAL_EMAIL");
    expect(src).toContain("SHA256_BUSINESS_EMAIL");
  });
});

describe("Cursive module — one-flow setup wiring", () => {
  it("startCursiveSetup server action is exported and mints a webhook token", () => {
    const src = readFile("lib/actions/cursive-connect.ts");
    expect(src).toContain("export async function startCursiveSetup");
    expect(src).toContain("export async function getCursiveSetupStatus");
    expect(src).toContain("crypto.randomBytes(16).toString(\"hex\")");
    // Setup must NOT require a pixel ID up front — the whole point of
    // the one-flow rewrite. If a future edit re-introduces a Pixel ID
    // field on the setup form / action, this assertion will need
    // re-evaluation as a deliberate product decision.
    const setupBlock = src.slice(src.indexOf("export async function startCursiveSetup"));
    expect(setupBlock).not.toMatch(/formData\.get\(\s*['\"]cursivePixelId['\"]\s*\)/);
  });

  it("setup wizard component renders the webhook URL + verification poller", () => {
    const src = readFile(
      "components/portal/integrations/cursive-setup-wizard.tsx",
    );
    expect(src).toContain("startCursiveSetup");
    expect(src).toContain("getCursiveSetupStatus");
    expect(src).toContain("CursiveWebhookBadge");
    // Polling cadence + cap — keep the wizard reactive without burning
    // server time on abandoned tabs.
    expect(src).toContain("POLL_INTERVAL_MS");
    expect(src).toContain("POLL_MAX_MINUTES");
  });

  it("webhook badge surfaces Pending vs Connected by lastEventAt", () => {
    const src = readFile(
      "components/portal/integrations/cursive-webhook-badge.tsx",
    );
    expect(src).toContain("Pending verification");
    expect(src).toContain("Last event");
    expect(src).toContain("lastEventAtIso");
  });

  it("integrations page swaps the legacy ConnectPixelForm for the wizard", () => {
    const src = readFile("app/portal/settings/integrations/page.tsx");
    expect(src).toContain("CursiveSetupWizard");
    // Legacy ops-fulfillment request path must still render when one
    // exists (so customers mid-flow on the old path see the expected
    // copy), but new connects must NOT use ConnectPixelForm.
    expect(src).not.toMatch(/<ConnectPixelForm/);
  });
});

describe("Cursive module — auto-bind from first event", () => {
  it("processCursiveEvent captures pixel_id when integration row has no cursivePixelId", () => {
    const src = readFile("lib/webhooks/cursive-process.ts");
    // The path-token branch must contain the auto-bind logic that
    // writes cursivePixelId on first event. We assert presence of the
    // update + the null-guarded where clause that keeps the bind
    // race-safe.
    expect(src).toContain("cursivePixelId: pixelId");
    expect(src).toMatch(
      /updateMany\([\s\S]*?cursivePixelId:\s*null/m,
    );
  });

  it("path-token webhook route surfaces the integration id for auto-bind", () => {
    const src = readFile("app/api/webhooks/cursive/[token]/route.ts");
    // Without id + propertyId on the override the processor can't
    // safely write back the captured pixel_id.
    expect(src).toContain("id: true,");
    expect(src).toContain("propertyId: true,");
  });
});

describe("Cursive module — no automated outreach to visitors", () => {
  // This block used to assert that the visitor-outreach cron was correctly
  // GATED. The whole feature was removed on 2026-07-29: it cold-emailed
  // pixel-identified people who never opted in, from the LeaseStack domain,
  // greeting ~41% of them by the wrong name (identity resolution attached a
  // different person's address), for housing — a protected advertising
  // category. 65 sent, 0 leads, 0 tours. The guard is now the inverse.
  it("has no visitor-outreach cron route", () => {
    expect(
      fs.existsSync(
        path.resolve(__dirname, "..", "app/api/cron/visitor-outreach/route.ts"),
      ),
    ).toBe(false);
  });

  it("is not scheduled in vercel.json", () => {
    const crons: Array<{ path: string }> =
      JSON.parse(readFile("vercel.json")).crons ?? [];
    expect(crons.map((c) => c.path)).not.toContain("/api/cron/visitor-outreach");
  });

  it("no longer ships an outreach email sender", () => {
    expect(readFile("lib/email/visitor-emails.ts")).not.toContain(
      "export async function sendVisitorOutreachEmail",
    );
  });
});
