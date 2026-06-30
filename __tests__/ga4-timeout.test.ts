import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P1 reliability — every GA4 runReport call must carry a timeout so a slow /
// hung Google Analytics Data API request can't block the /portal/attribution
// page (the calls run inside a Promise.all). On timeout the caller's try/catch
// degrades to pixel-only attribution instead of hanging the dashboard.

const src = fs.readFileSync(
  path.resolve(__dirname, "../lib/integrations/ga4.ts"),
  "utf-8",
);

describe("GA4 runReport timeout", () => {
  it("defines a runReport timeout constant", () => {
    expect(src).toMatch(/GA4_RUNREPORT_TIMEOUT_MS\s*=\s*\d+/);
  });

  it("passes the timeout option to every runReport call", () => {
    const calls = src.match(/runReport\(/g) ?? [];
    const timeouts = src.match(/timeout:\s*GA4_RUNREPORT_TIMEOUT_MS/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    // One timeout option per runReport call site.
    expect(timeouts.length).toBe(calls.length);
  });

  it("has no bare runReport call missing the options arg", () => {
    // A runReport whose params object closes with `});` (no second arg) is a
    // miss. After the fix every call ends `}, { timeout: ... });`.
    expect(src).not.toMatch(/limit:\s*"\d+",\s*\n\s*},\s*\n\s*\}\);/);
  });
});
