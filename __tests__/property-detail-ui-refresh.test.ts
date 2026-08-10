import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("property detail UI refresh", () => {
  it("uses a compact identity header and restrained KPI sizing", () => {
    const hero = read("components/portal/properties/property-hero-banner.tsx");

    expect(hero).toContain("Property overview");
    expect(hero).toContain('sm:grid-cols-[160px_minmax(0,1fr)]');
    expect(hero).toContain('"text-2xl sm:text-3xl"');
    expect(hero).not.toContain('"text-3xl sm:text-4xl md:text-5xl"');
    expect(hero).not.toContain("Featured property");
  });

  it("renders intelligence as a compact action queue without decorative gradients", () => {
    const panel = read("components/portal/properties/property-intelligence-panel.tsx");

    expect(panel).toContain("Next actions");
    expect(panel).toContain("actions.slice(0, 3)");
    expect(panel).not.toContain("bg-gradient-to-br");
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
