import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("visitor enrichment timestamp", () => {
  it("keeps enrichment refresh time separate from real visit time", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read(
      "prisma/migrations/20260809_add_visitor_last_enriched_at/migration.sql",
    );

    expect(schema).toContain("lastEnrichedAt DateTime?");
    expect(migration).toContain('ADD COLUMN "lastEnrichedAt"');
    expect(migration).not.toContain('"lastSeenAt"');
  });
});
