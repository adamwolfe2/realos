import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Structural guards for two 2026-07-31 parallel-review findings:
//
// 1. Engage route: the sessionId MUST resolve to a ChatbotConversation in
//    the caller's org. The old guard (`if (!visitor && !convo)`) let an
//    operator pass their own visitorId plus a FOREIGN org's sessionId —
//    the public inbox endpoint has no org filter, so the message would be
//    delivered cross-tenant.
//
// 2. Manual-entry actions: writes must stay behind the role allowlist,
//    the moduleResidents entitlement, the rate limiter, and the
//    marketable-property check (non-ACTIVE properties are filtered from
//    every list surface, so records on them silently disappear).

const ROOT = path.resolve(__dirname, "..");

describe("engage route — session must resolve in-org", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "app/api/tenant/visitors/[visitorId]/engage/route.ts"),
    "utf-8",
  );

  it("requires the conversation lookup (no visitor-only OR fallback)", () => {
    expect(src).not.toContain("!visitor && !convo");
    expect(src).toMatch(/if \(!convo\)/);
  });
});

describe("manual-entry actions — write gates intact", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "lib/actions/manual-records.ts"),
    "utf-8",
  );

  it("keeps role allowlist, entitlement, rate limit, marketable filter", () => {
    expect(src).toContain("ALLOWED_WRITE_ROLES");
    expect(src).toContain("moduleResidents");
    expect(src).toContain("checkRateLimit");
    expect(src).toContain("marketablePropertyWhere");
    // Every exported create action must pass through the shared gate.
    const gateCalls = src.match(/await gateManualWrite\(scope\)/g) ?? [];
    expect(gateCalls.length).toBe(3);
  });
});
