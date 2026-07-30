import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression for PORTAL-PROPERTIES-D004: the org-wide /portal/work-orders
// kanban cards omitted the ticket description that the per-property
// equivalent (tabs/work-orders.tsx) already shows. Both views query
// WorkOrder via `include` (no `select`), so `description` was always on
// the row — it just wasn't rendered on the org-wide board.

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("work-orders kanban — ticket description parity", () => {
  it("org-wide board renders w.description like the per-property tab does", () => {
    const orgWide = readFile("app/portal/work-orders/page.tsx");
    const perProperty = readFile(
      "app/portal/properties/[id]/tabs/work-orders.tsx",
    );
    expect(perProperty).toContain("{w.description}");
    expect(orgWide).toContain("{w.description}");
  });
});
