import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("attribution flow visual", () => {
  it("shows LeaseStack-owned sources flowing into AppFolio outcomes", () => {
    const component = read(
      "components/portal/attribution/attribution-flow.tsx",
    );

    expect(component).toContain("Chatbot");
    expect(component).toContain("Popups and forms");
    expect(component).toContain("Visitor pixel");
    expect(component).toContain("Captured");
    expect(component).toContain("Applied in AppFolio");
    expect(component).toContain("Signed in AppFolio");
    expect(component).not.toContain("Tour scheduled");
    expect(component).not.toContain("Toured");
  });

  it("uses an accessible animated SVG with a reduced-motion fallback", () => {
    const component = read(
      "components/portal/attribution/attribution-flow.tsx",
    );
    const css = read("app/globals.css");

    expect(component).toContain('<svg');
    expect(component).toContain('role="img"');
    expect(component).toContain("attribution-flow-path");
    expect(css).toContain("@keyframes attribution-flow-draw");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("replaces the old nine-stage funnel on the page", () => {
    const page = read("app/portal/attribution/page.tsx");

    expect(page).toContain("<AttributionFlow");
    expect(page).not.toContain("proof.funnel.map");
  });
});
