import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Structural regression guards for the 2026 security-audit remediation. Each
// asserts that a specific hardening remains present in the source, so a future
// refactor can't silently reintroduce the vulnerability. Companion to the
// behavioral tests (security-internal-call, security-intake-blob-url,
// security-chatbot-origin-bypass, require-admin-clerk-lookup).
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("exported server actions that take orgId are token-gated", () => {
  it("executeSegmentPush requires the INTERNAL_CALL capability", () => {
    const src = read("lib/actions/audiences.ts");
    // The function must accept and assert the internal token.
    expect(src).toMatch(/executeSegmentPush\([\s\S]*?internal:\s*InternalCall/);
    expect(src).toMatch(/assertInternalCall\(internal\)/);
  });

  it("runCursiveSegmentSync requires the INTERNAL_CALL capability", () => {
    const src = read("lib/actions/admin-cursive.ts");
    expect(src).toMatch(/runCursiveSegmentSync\([\s\S]*?internal:\s*InternalCall/);
    expect(src).toMatch(/assertInternalCall\(internal\)/);
  });
});

describe("start-trial cannot re-grant entitlements to churned/paused orgs", () => {
  it("excludes CANCELED and PAUSED from the re-trial eligibility clause", () => {
    const src = read("app/api/onboarding/wizard/start-trial/route.ts");
    expect(src).toMatch(/SubscriptionStatus\.CANCELED/);
    expect(src).toMatch(/SubscriptionStatus\.PAUSED/);
    expect(src).toMatch(/SubscriptionStatus\.ACTIVE/);
    expect(src).toMatch(/SubscriptionStatus\.PAST_DUE/);
  });
});

describe("unauthenticated site-request upload rejects executable types", () => {
  it("uses an exact MIME allowlist, not an 'image/' prefix (no SVG)", () => {
    const src = read("app/api/site-requests/upload/route.ts");
    expect(src).not.toMatch(/ALLOWED_MIME_PREFIXES/);
    expect(src).toMatch(/ALLOWED_MIME_TYPES/);
    // SVG/HTML must not be an allowlisted value (quoted entry, not prose).
    expect(src).not.toMatch(/["']image\/svg/);
    expect(src).not.toMatch(/["']text\/html/);
    // Served content-type is pinned server-side.
    expect(src).toMatch(/contentType:\s*mimeType/);
  });
});

describe("creative-request by-id routes enforce property-level RBAC", () => {
  for (const rel of [
    "app/api/tenant/creative-requests/[id]/status/route.ts",
    "app/api/tenant/creative-requests/[id]/messages/route.ts",
  ]) {
    it(`${rel} calls propertyInScope`, () => {
      const src = read(rel);
      expect(src).toMatch(/propertyInScope\(scope,\s*current\.propertyId\)/);
    });
  }
});

describe("URL-fetching routes use the central DNS-resolving SSRF guard", () => {
  it("site-request packet fetch is SSRF-guarded", () => {
    const src = read("app/api/site-requests/[id]/packet/route.ts");
    expect(src).toMatch(/assertPublicHttpUrl/);
    expect(src).toMatch(/safeFetchFollowingRedirects/);
    // The old unguarded fetch(asset.blobUrl) must be gone.
    expect(src).not.toMatch(/fetch\(asset\.blobUrl\)/);
  });

  it("AEO on-page audit direct fetch is SSRF-guarded", () => {
    const src = read("lib/aeo/run-onpage-audit.ts");
    expect(src).toMatch(/assertPublicHttpUrl/);
    expect(src).toMatch(/safeFetchFollowingRedirects/);
  });
});

describe("requireAdmin enforces org type, not role alone", () => {
  it("require-admin.ts checks OrgType.AGENCY", () => {
    const src = read("lib/auth/require-admin.ts");
    const occurrences = src.match(/OrgType\.AGENCY/g) ?? [];
    // Both requireAdmin and requireAdminOrRep must check it.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe("marketplace magic-link routes are rate-limited", () => {
  for (const rel of [
    "app/api/marketplace/auth/request/route.ts",
    "app/api/marketplace/seller-auth/request/route.ts",
  ]) {
    it(`${rel} calls checkRateLimit`, () => {
      const src = read(rel);
      expect(src).toMatch(/checkRateLimit\(/);
    });
  }
});
