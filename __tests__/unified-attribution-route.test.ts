import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("unified attribution surface", () => {
  it("keeps exactly one attribution item in portal navigation", () => {
    const nav = read("components/portal/portal-nav.tsx");
    expect(nav).toContain('href: "/portal/attribution"');
    expect(nav).not.toContain('href: "/portal/reverse-attribution"');
    expect(nav).not.toContain('label: "Reverse Attribution"');
  });

  it("redirects old reverse-attribution bookmarks to the unified page", () => {
    const page = read("app/portal/reverse-attribution/page.tsx");
    expect(page).toContain('redirect(`/portal/attribution');
    expect(page).toContain("URLSearchParams");
  });

  it("renders one proof ledger instead of decorative attribution charts", () => {
    const page = read("app/portal/attribution/page.tsx");
    expect(page).toContain("Lead proof ledger");
    expect(page).toContain("Verified signed");
    expect(page).toContain("Match review queue");
    expect(page).not.toContain("TrendChart");
  });
});
