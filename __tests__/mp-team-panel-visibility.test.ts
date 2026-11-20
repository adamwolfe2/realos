import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  inviteMustNameProperties,
  teamMembersForViewer,
} from "@/lib/portal/team-visibility";

// ---------------------------------------------------------------------------
// Per-property users, Team panel. Org with properties A, B, C. The panel
// listed every teammate and every org property to a viewer restricted to B,
// and the invite form defaulted to "org-wide", which the server rejects for
// restricted inviters and scoped roles.
// ---------------------------------------------------------------------------

const members = [
  { id: "owner", propertyIds: [] }, // unrestricted
  { id: "self", propertyIds: ["prop-b"] },
  { id: "on-b", propertyIds: ["prop-b"] },
  { id: "on-a", propertyIds: ["prop-a"] },
  { id: "on-a-and-b", propertyIds: ["prop-a", "prop-b"] },
];

describe("teamMembersForViewer", () => {
  it("unrestricted viewer sees everyone", () => {
    expect(teamMembersForViewer({ userId: "owner", allowedPropertyIds: null }, members)).toHaveLength(5);
  });

  it("viewer restricted to B sees self and teammates wholly inside B", () => {
    const shown = teamMembersForViewer(
      { userId: "self", allowedPropertyIds: ["prop-b"] },
      members,
    ).map((m) => m.id);
    expect(shown).toEqual(["self", "on-b"]);
  });
});

describe("inviteMustNameProperties", () => {
  it("scoped roles and restricted inviters must name properties", () => {
    expect(inviteMustNameProperties(false, "LEASING_AGENT")).toBe(true);
    expect(inviteMustNameProperties(false, "CLIENT_VIEWER")).toBe(true);
    expect(inviteMustNameProperties(true, "CLIENT_ADMIN")).toBe(true);
    expect(inviteMustNameProperties(false, "CLIENT_ADMIN")).toBe(false);
  });
});

describe("settings page wiring", () => {
  it("passes the filtered members, the viewer's properties and the restriction flag", () => {
    const src = fs.readFileSync("app/portal/settings/page.tsx", "utf8");
    expect(src).toContain("teamMembersForViewer(");
    expect(src).toContain("properties={visibleProperties(scope, properties)}");
    expect(src).toContain("inviterRestricted={scope.allowedPropertyIds !== null}");
    expect(src).not.toMatch(/prisma\.property\.findMany\(\{\s*where: \{ orgId: scope\.orgId \}/);
    const panel = fs.readFileSync("app/portal/settings/team-panel.tsx", "utf8");
    expect(panel).toContain("inviteMustNameProperties(");
  });
});
