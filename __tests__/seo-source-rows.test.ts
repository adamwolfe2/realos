import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildSeoSourceRows } from "@/lib/seo/source-rows";

// Regression (multi-property): /portal/seo's Sources panel rendered the first
// GSC and first GA4 integration in the org. With two ACTIVE properties A and
// B, B's sync error was hidden behind A's healthy row.

type I = {
  id: string;
  propertyId: string | null;
  provider: "GSC" | "GA4";
  lastSyncError: string | null;
};

const A = { id: "A", name: "Alpha House" };
const B = { id: "B", name: "Beta House" };
const integrations: I[] = [
  { id: "a-gsc", propertyId: "A", provider: "GSC", lastSyncError: null },
  { id: "b-gsc", propertyId: "B", provider: "GSC", lastSyncError: "403 from Google" },
  { id: "b-ga4", propertyId: "B", provider: "GA4", lastSyncError: null },
];

describe("buildSeoSourceRows", () => {
  it("gives each property its own GSC/GA4 state", () => {
    const rows = buildSeoSourceRows([A, B], integrations);
    expect(rows.map((r) => [r.label, r.gsc?.id ?? null, r.ga4?.id ?? null])).toEqual([
      ["Alpha House", "a-gsc", null],
      ["Beta House", "b-gsc", "b-ga4"],
    ]);
    expect(rows[1].gsc?.lastSyncError).toBe("403 from Google");
  });

  it("shows only the selected property's row", () => {
    const rows = buildSeoSourceRows([B], integrations);
    expect(rows.map((r) => r.propertyId)).toEqual(["B"]);
  });

  it("adds an org-wide row only when a NULL-scoped connection is in the list", () => {
    const withOrg = [
      ...integrations,
      { id: "org-ga4", propertyId: null, provider: "GA4" as const, lastSyncError: null },
    ];
    const rows = buildSeoSourceRows([A, B], withOrg);
    expect(rows.at(-1)).toMatchObject({ propertyId: null, ga4: { id: "org-ga4" }, gsc: null });
    expect(buildSeoSourceRows([A], integrations).some((r) => r.propertyId === null)).toBe(false);
  });
});

describe("/portal/seo Sources panel wiring", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "app/portal/seo/page.tsx"), "utf8");
  it("renders rows from buildSeoSourceRows over the effective selection", () => {
    expect(src).toContain("buildSeoSourceRows(");
    expect(src).toMatch(/properties\.filter\(\(p\) => effectiveIds\.includes\(p\.id\)\)/);
    expect(src).not.toMatch(/integrations\.find\(\(i\) => i\.provider === SeoProvider\.GSC\)/);
  });
  it("disconnects the row's own property connection", () => {
    expect(src).toContain("<DisconnectSeoForm provider={provider} propertyId={propertyId} />");
  });
});
