import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression for RISK-058: resubmitting a SEO draft with changes creates a
// new draft, then PATCHes the original to cancel it so only one draft stays
// active per brief. The PATCH was fire-and-forget (`.catch(() => undefined)`)
// with no check on the response — a failed cancel silently left two active
// drafts for one brief with no operator-visible signal.
//
// This repo's vitest config is Node-only (no jsdom/testing-library), so this
// is a structural check on the fetch call rather than a full component
// render — consistent with the existing seo-module.test.ts pattern.

const ROOT = path.resolve(__dirname, "..");

describe("ResubmitWithChangesButton — cancel PATCH failure handling", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "components/portal/seo/resubmit-with-changes-button.tsx"),
    "utf-8",
  );

  it("captures the cancel PATCH response instead of discarding it", () => {
    // The old bug: `.catch(() => undefined)` with the result never assigned
    // or checked, so a non-2xx response (network ok, server rejects) was
    // indistinguishable from success.
    expect(src).toMatch(/const cancelRes\s*=\s*await fetch/);
  });

  it("checks cancelRes.ok and warns the operator when the cancel failed", () => {
    expect(src).toMatch(/!cancelRes(?:\.ok)?\s*\|\|\s*!cancelRes\.ok/);
    expect(src).toContain("toast.warning");
  });
});
