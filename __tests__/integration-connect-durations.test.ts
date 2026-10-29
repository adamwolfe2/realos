// #182 review: connect-time backfills run in after() inside the picker
// action, so the picker pages need the long duration; and the ads-sync
// state predicates must not skip NULL accessStatus rows.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("integration connect durations and predicates", () => {
  it.each(["ga4", "google-ads", "gsc", "meta-ads"])("%s picker exports maxDuration = 300", (p) => {
    const src = readFileSync(`app/portal/connect/${p}/select/page.tsx`, "utf8");
    expect(src).toMatch(/export const maxDuration = 300;/);
  });

  it("ads-sync guarded updates include NULL accessStatus", () => {
    const src = readFileSync("lib/integrations/ads-sync.ts", "utf8");
    expect(src).not.toMatch(/where: \{ id: account\.id, accessStatus: \{ not: "revoked" \} \}/);
    expect(src.match(/OR: \[\{ accessStatus: null \}, \{ accessStatus: \{ not: "revoked" \} \}\]/g)?.length).toBe(2);
  });
});
