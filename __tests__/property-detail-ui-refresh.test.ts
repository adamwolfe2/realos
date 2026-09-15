import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("property detail UI refresh", () => {
  it("uses a compact identity header and restrained KPI sizing", () => {
    const hero = read("components/portal/properties/property-hero-banner.tsx");

    expect(hero).toContain("Property overview");
    expect(hero).toContain('sm:grid-cols-[160px_minmax(0,1fr)]');
    expect(hero).not.toContain('"text-3xl sm:text-4xl md:text-5xl"');
    expect(hero).not.toContain("Featured property");
  });

  // 2026-09-15: the hero stats were display-font numerals with mono labels
  // and a bare coloured delta string — a second stat vocabulary that made
  // the property page read as a different product from the dashboard it
  // links out of. They now use the same three primitives KpiTile does.
  it("states hero metrics in the dashboard's KPI vocabulary", () => {
    const hero = read("components/portal/properties/property-hero-banner.tsx");

    expect(hero).toContain("ls-metric");
    expect(hero).toContain("ls-eyebrow");
    expect(hero).toContain("ls-delta-up");
    expect(hero).not.toContain("font-display font-semibold tabular-nums");
    // ls-metric-* are plain CSS classes, not registered Tailwind
    // utilities, so a responsive variant would silently emit nothing.
    expect(hero).not.toMatch(/sm:ls-metric-/);
  });

  // The "Next actions" panel duplicated the dashboard's "Needs your
  // attention" queue row for row. Removed 2026-09-15; the queue lives on
  // the dashboard and the property tabs carry the per-building detail.
  it("does not re-mount the intelligence action queue on the property page", () => {
    const page = read("app/portal/properties/[id]/page.tsx");

    // Symbols, not prose: the page keeps a comment explaining the
    // removal, so a bare "Next actions" string match would trip on it.
    expect(page).not.toContain("PropertyIntelligencePanel");
    expect(page).not.toContain("getPropertyRecommendations");
    expect(page).not.toContain("<IntelligenceSection");
  });

  it("groups every property section under four stable navigation groups", () => {
    const tabs = read("app/portal/properties/[id]/property-tabs.tsx");

    expect(tabs).toContain("const GROUPS");
    expect(tabs).toContain('label: "Marketing"');
    expect(tabs).toContain('label: "Leasing"');
    expect(tabs).toContain('label: "Operations"');
    expect(tabs).toContain("TAB_TO_GROUP");
    expect(tabs).toContain('"work-orders"');
  });

  it("tightens the overview into a balanced work-and-context layout", () => {
    const overview = read("app/portal/properties/[id]/tabs/overview.tsx");

    expect(overview).toContain(
      "lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)] gap-4",
    );
    expect(overview).toContain('className="space-y-4 min-w-0"');
    expect(overview).not.toContain('className="space-y-6 min-w-0"');
  });
});
