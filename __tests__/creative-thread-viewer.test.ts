import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Review-A LOW: the creative thread renders the agency view only for real
// agency scopes, not for any impersonator (AL_PARTNER can impersonate).
describe("creative request page viewer", () => {
  it("derives viewer from scope.isAgency, not isImpersonating", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../app/portal/creative/[id]/page.tsx"),
      "utf8",
    );
    expect(src).toContain('viewer={scope.isAgency ? "agency" : "client"}');
    expect(src).not.toMatch(/viewer=\{scope\.isImpersonating/);
  });
});
