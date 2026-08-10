import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("LeadMatchDecision persistence", () => {
  it("defines an append-only tenant/property-scoped decision model", () => {
    const schema = read("prisma/schema.prisma");

    expect(schema).toContain("enum LeadMatchDecisionStatus");
    expect(schema).toContain("REVIEW_REQUIRED");
    expect(schema).toContain("enum LeadMatchMethod");
    expect(schema).toContain("model LeadMatchDecision");
    expect(schema).toContain("confidence Int");
    expect(schema).toContain("evidence   Json?");
    expect(schema).toContain("@@index([orgId, status, createdAt])");
    expect(schema).toContain("@@index([residentId, createdAt])");
    expect(schema).toContain("@@index([leadId, createdAt])");
  });

  it("ships the model as a handwritten additive migration", () => {
    const migration = read(
      "prisma/migrations/20260809_add_lead_match_decisions/migration.sql",
    );

    expect(migration).toContain('CREATE TYPE "LeadMatchDecisionStatus"');
    expect(migration).toContain('CREATE TYPE "LeadMatchMethod"');
    expect(migration).toContain('CREATE TABLE "LeadMatchDecision"');
    expect(migration).toContain(
      'FOREIGN KEY ("orgId") REFERENCES "Organization"("id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("residentId") REFERENCES "Resident"("id")',
    );
  });
});
