import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  effectivePropertyIds,
  isAccessDenied,
  propertyOrOrgLevelWhereFragment,
  propertyWhereFragment,
} from "@/lib/tenancy/property-filter";
import { propertyInScope } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Multi-property guard. Two layers:
//   1. Behaviour of the shared scoping helpers for a two-property org
//      (prop-a, prop-b) with an unrestricted user and a user restricted to
//      prop-a: a selection outside the grant must fail closed, never widen.
//   2. Structural: every server action under lib/actions that handles a
//      propertyId must reference a property-grant gate. Known gaps owned by
//      other work are allowlisted with a reason; shrink the list, never grow
//      it without one.
// ---------------------------------------------------------------------------

const open = { orgId: "org-1", allowedPropertyIds: null };
const onlyA = { orgId: "org-1", allowedPropertyIds: ["prop-a"] };

describe("scoping helpers — two-property org", () => {
  it("unrestricted: no selection = no filter, selection = that property", () => {
    expect(propertyWhereFragment(open, null)).toEqual({});
    expect(propertyWhereFragment(open, ["prop-b"])).toEqual({ propertyId: "prop-b" });
    expect(propertyWhereFragment(open, ["prop-a", "prop-b"])).toEqual({
      propertyId: { in: ["prop-a", "prop-b"] },
    });
  });

  it("restricted: no selection = the grant; foreign selection = match nothing", () => {
    expect(effectivePropertyIds(onlyA, null)).toEqual(["prop-a"]);
    expect(propertyWhereFragment(onlyA, null)).toEqual({ propertyId: "prop-a" });
    expect(isAccessDenied(onlyA, ["prop-b"])).toBe(true);
    expect(propertyWhereFragment(onlyA, ["prop-b"])).toEqual({
      propertyId: "__no_property_access__",
    });
    // The org-level widening must not re-open a denied selection.
    expect(propertyOrOrgLevelWhereFragment(onlyA, ["prop-b"])).toEqual({
      propertyId: "__no_property_access__",
    });
    // Mixed selection drops the foreign id.
    expect(propertyWhereFragment(onlyA, ["prop-a", "prop-b"])).toEqual({
      propertyId: "prop-a",
    });
  });

  it("propertyInScope: record-level gate for write paths", () => {
    const s = onlyA as Parameters<typeof propertyInScope>[0];
    expect(propertyInScope(s, "prop-a")).toBe(true);
    expect(propertyInScope(s, "prop-b")).toBe(false);
    expect(propertyInScope(s, null)).toBe(true); // org-level row
  });
});

const GATE_RE =
  /\b(propertyInScope|allowedPropertyIds|propertyWhereFragment|propertyOrOrgLevelWhereFragment|marketableScopedPropertyClause|effectivePropertyIds|canAccessReport)\b/;

const KNOWN_GAPS: Record<string, string> = {
  "lib/actions/ad-library.ts": "ads slice: saves an ad with any org propertyId",
  "lib/actions/popup-actions.ts": "popups slice: create/update/delete popups by org only",
  "lib/actions/seo-connect.ts": "SEO slice: workspace-admin only",
  "lib/actions/seo-oauth-bind.ts": "SEO slice: binds an org integration",
  "lib/actions/neighborhood-pages-helpers.ts": "pure mapper, no query",
};

describe("lib/actions property-grant guard", () => {
  it("every action file handling propertyId references a grant gate", () => {
    const dir = path.resolve(__dirname, "../lib/actions");
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `lib/actions/${f}`)
      .filter((rel) => {
        const src = fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
        return /\bpropertyId\b/.test(src) && !GATE_RE.test(src);
      })
      .filter((rel) => !(rel in KNOWN_GAPS));
    expect(offenders).toEqual([]);
  });
});
