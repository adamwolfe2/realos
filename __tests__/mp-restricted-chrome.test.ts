import { describe, it, expect } from "vitest";
import fs from "fs";

// ---------------------------------------------------------------------------
// Per-property users, portal chrome. A teammate restricted to property B saw
// org-wide sidebar badge counts and property count (layout), and every
// property name in the vault's property dropdown. Structural guard: these
// server components render too much context to unit-render cheaply.
// ---------------------------------------------------------------------------

describe("restricted user chrome", () => {
  it("layout narrows the badge/property id set to the user's grant", () => {
    const src = fs.readFileSync("app/portal/layout.tsx", "utf8");
    expect(src).toContain("const gatedProps = visibleProperties(scope, marketableProps);");
    expect(src).toContain("const marketableIds = gatedProps.map((p) => p.id);");
    expect(src).toContain("const propertyCount = gatedProps.length;");
  });

  it("vault property dropdown is limited to enabled properties in the grant", () => {
    const src = fs.readFileSync("app/portal/vault/page.tsx", "utf8");
    expect(src).not.toMatch(
      /prisma\.property\.findMany\(\{\s*where: \{ orgId: scope\.orgId \}/,
    );
    expect(src).toMatch(
      /marketablePropertyWhere\(scope\.orgId\),\s*\.\.\.\(scope\.allowedPropertyIds\s*\?\s*\{ id: \{ in: scope\.allowedPropertyIds \} \}/,
    );
  });
});
