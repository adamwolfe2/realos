import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { canAccessReport, isReportStatusRestricted } from "@/lib/reports/access";

// ---------------------------------------------------------------------------
// P0: draft ClientReports were visible to real client users. lib/actions/
// reports.ts documents "operator review is mandatory so nothing here ever
// auto-sends", but the portal list defaulted to showing every status and the
// detail page never checked status at all — a client with a report id (or a
// hand-crafted ?status=draft URL) could read an unreviewed draft.
//
// Policy: non-agency, non-impersonating scopes (real CLIENT_* users) see
// ONLY status="shared" reports. Agency scopes and impersonating scopes (the
// operators doing the review) keep full visibility — same split as the
// existing property RBAC gate in this file.
// ---------------------------------------------------------------------------

describe("isReportStatusRestricted", () => {
  it("real client scope (not agency, not impersonating) is restricted", () => {
    expect(
      isReportStatusRestricted({ isAgency: false, isImpersonating: false }),
    ).toBe(true);
  });

  it("agency scope is never restricted", () => {
    expect(
      isReportStatusRestricted({ isAgency: true, isImpersonating: false }),
    ).toBe(false);
  });

  it("impersonating scope is never restricted, even if the underlying org is CLIENT", () => {
    expect(
      isReportStatusRestricted({ isAgency: false, isImpersonating: true }),
    ).toBe(false);
  });

  it("agency + impersonating (belt and suspenders) is never restricted", () => {
    expect(
      isReportStatusRestricted({ isAgency: true, isImpersonating: true }),
    ).toBe(false);
  });
});

describe("canAccessReport — unchanged by the status gate", () => {
  it("unrestricted property scope still sees any propertyId", () => {
    expect(canAccessReport({ allowedPropertyIds: null }, null)).toBe(true);
    expect(canAccessReport({ allowedPropertyIds: null }, "prop-a")).toBe(true);
  });

  it("property-restricted scope still denied for org-wide + out-of-scope", () => {
    expect(canAccessReport({ allowedPropertyIds: ["prop-a"] }, null)).toBe(false);
    expect(canAccessReport({ allowedPropertyIds: ["prop-a"] }, "prop-b")).toBe(false);
    expect(canAccessReport({ allowedPropertyIds: ["prop-a"] }, "prop-a")).toBe(true);
  });
});

// Structural guards — the RSC pages pull in Clerk/next-cache/prisma and are
// impractical to render in vitest (same tradeoff public-report-onepager.test
// already made for /r/[token]). Assert the gate is actually wired in, not
// just defined.
const listPagePath = path.resolve(__dirname, "../app/portal/reports/page.tsx");
const detailPagePath = path.resolve(
  __dirname,
  "../app/portal/reports/[id]/page.tsx",
);
const readList = () => fs.readFileSync(listPagePath, "utf-8");
const readDetail = () => fs.readFileSync(detailPagePath, "utf-8");

describe("/portal/reports list — status clamp wired in", () => {
  it("imports and calls the status gate", () => {
    const content = readList();
    expect(content).toContain("isReportStatusRestricted");
    expect(content).toContain("statusRestricted");
  });

  it("forces status='shared' for restricted scope ahead of the ?status= filter", () => {
    const content = readList();
    const clampIdx = content.indexOf('where.status = "shared"');
    const spStatusIdx = content.indexOf("sp.status === \"draft\"");
    expect(clampIdx).toBeGreaterThan(-1);
    // The clamp branch must be the `if`, with the ?status= filter only
    // reachable via `else if` — so a restricted scope can never fall through
    // to the caller-supplied status value.
    expect(content).toMatch(
      /if \(statusRestricted\) \{\s*where\.status = "shared";\s*\} else if \(sp\.status/,
    );
    expect(spStatusIdx).toBeGreaterThan(clampIdx);
  });
});

describe("/portal/reports/[id] detail — draft gate wired in", () => {
  it("404s a restricted scope loading a non-shared report", () => {
    const content = readDetail();
    expect(content).toContain("isReportStatusRestricted");
    expect(content).toMatch(
      /isReportStatusRestricted\(scope\) && report\.status !== "shared"/,
    );
    // Same notFound() call as the property gate directly above it — no
    // separate error shape that could leak "a draft exists here".
    const gateIdx = content.indexOf("isReportStatusRestricted(scope)");
    expect(content.slice(gateIdx, gateIdx + 90)).toContain("notFound()");
  });
});
