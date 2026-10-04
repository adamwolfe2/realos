import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

// No DOM test env in this repo: guard that the popup stays on the Radix dialog
// wrapper (focus trap, Escape, focus restore) and keeps the tenant colour.
it("exit-intent popup uses ui/dialog and re-applies --tenant-primary", () => {
  const src = readFileSync("components/tenant-site/exit-intent-popup.tsx", "utf8");
  expect(src).toContain('@/components/ui/dialog');
  expect(src).toContain("<DialogContent");
  expect(src).toContain('"--tenant-primary": tenantPrimary');
  expect(src).not.toContain('role="dialog"');
});
