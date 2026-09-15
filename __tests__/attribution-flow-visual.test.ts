import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("attribution filtered ledger", () => {
  it("keeps the ledger primary and removes the oversized flow graph", () => {
    const page = read("app/portal/attribution/page.tsx");

    expect(page).not.toContain("<AttributionFlow");
    expect(page).not.toContain("proof.funnel.map");
    expect(page).toContain("Lead proof ledger");
  });

  it("offers compact source filters with a visible active state", () => {
    const page = read("app/portal/attribution/page.tsx");

    expect(page).toContain("SOURCE_FILTERS");
    expect(page).toContain("sourceFilterHref");
    expect(page).toContain("Chatbot");
    expect(page).toContain("Popups and forms");
    expect(page).toContain("Visitor pixel");
    // The active filter is a solid brand fill. Pinned as the design token
    // rather than a raw Tailwind palette step, so the active state cannot
    // drift away from --color-primary the way bg-blue-600 had.
    expect(page).toContain("bg-primary");
    expect(page).not.toContain("bg-blue-600");
    expect(page).toContain("font-semibold text-primary-foreground");
  });

  it("highlights LeaseStack sources without tinting the entire table", () => {
    const page = read("app/portal/attribution/page.tsx");
    const css = read("app/globals.css");

    expect(page).toContain("<SourceBadge");
    // A tinted chip, not a tinted row — and on the primary token, so the
    // badge matches every other brand surface in the portal.
    expect(page).toContain("bg-primary/15 text-primary-dark");
    expect(page).not.toContain("bg-blue-100");
    expect(page).not.toContain("sourceRowClass");
    expect(css).not.toContain("@keyframes attribution-flow-draw");
  });
});
