import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// F-011: the lead detail page must hide write controls from read-only seats.
// Structural check (the page is a heavy server component); the server stays
// authoritative via requireWritableWorkspace (see viewer-write-gate.test.ts).
const src = fs.readFileSync(
  path.resolve(__dirname, "../app/portal/leads/[id]/page.tsx"),
  "utf8",
);

describe("lead detail page hides write controls for viewers (F-011)", () => {
  it("derives canWrite from ALLOWED_WRITE_ROLES", () => {
    expect(src).toMatch(/const canWrite = ALLOWED_WRITE_ROLES\.has\(scope\.role\)/);
  });

  it.each([
    "LeadEmailComposer",
    "LeadSmsComposer",
    "LeadStatusForm",
    "LinkResidentForm",
    "AddNoteForm",
    "ReviewRequestButton",
    "MarkLostButton",
  ])("%s only renders behind canWrite", (component) => {
    const uses = [...src.matchAll(new RegExp(`<${component}\\b`, "g"))];
    expect(uses.length).toBeGreaterThan(0);
    for (const m of uses) {
      const before = src.slice(0, m.index);
      // A canWrite gate must open shortly before every usage.
      const lastGate = before.lastIndexOf("canWrite");
      expect(lastGate).toBeGreaterThan(-1);
      expect((m.index ?? 0) - lastGate).toBeLessThan(2000);
    }
  });

  it("AI follow-up cards render read-only for viewers", () => {
    expect(src).toMatch(/<AiFollowUpTaskCard[\s\S]{0,80}readOnly=\{!canWrite\}/);
  });
});
