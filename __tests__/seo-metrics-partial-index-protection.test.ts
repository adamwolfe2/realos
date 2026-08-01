import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Wave 3 Phase 5 review fix (#12 / #20): the six partial unique indexes that
// enforce "one org-wide SeoSnapshot/SeoQuery/SeoLandingPage row per date,
// plus at most one row per property per date" are invisible to Prisma's
// schema/migration diff engine (Prisma cannot express a partial unique
// index in schema.prisma). `prisma db push` or `prisma migrate dev` run
// against a real database could silently generate a DROP INDEX for any of
// them, after which the find-then-write sync path in
// lib/integrations/seo-sync.ts would start accumulating duplicate rows
// with no error anywhere.
//
// This is a structural guard, not a DB integration test: it asserts the
// migration file still declares all six indexes, and that schema.prisma
// still carries the warning telling a future editor never to run
// `prisma db push` / `prisma migrate dev` against a real database for
// this schema.
// ---------------------------------------------------------------------------

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../prisma/migrations/20260801_add_seo_metrics_property_dimension/migration.sql",
);
const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

const PARTIAL_UNIQUE_INDEX_NAMES = [
  "SeoSnapshot_org_date_orgwide_key",
  "SeoSnapshot_org_prop_date_key",
  "SeoQuery_org_date_query_orgwide_key",
  "SeoQuery_org_prop_date_query_key",
  "SeoLandingPage_org_date_url_orgwide_key",
  "SeoLandingPage_org_prop_date_url_key",
];

describe("SEO metrics partial unique indexes — schema drift protection", () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");

  it.each(PARTIAL_UNIQUE_INDEX_NAMES)(
    "migration.sql still creates %s",
    (indexName) => {
      expect(migrationSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}"`);
    },
  );

  it("schema.prisma warns never to run db push / migrate dev reset against a real DB for these models", () => {
    expect(schema).toMatch(/never use `?prisma db push`?/i);
    expect(schema).toMatch(/migrate dev/i);
    expect(schema).toMatch(/partial uniques? live only in (the )?SQL migrations?/i);
  });

  it("SeoSnapshot/SeoQuery/SeoLandingPage models declare no @@unique (partial uniques can't be expressed in Prisma)", () => {
    const modelNames = ["SeoSnapshot", "SeoQuery", "SeoLandingPage"];
    for (const name of modelNames) {
      const modelMatch = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
      expect(modelMatch, `model ${name} not found in schema.prisma`).toBeTruthy();
      expect(modelMatch![0]).not.toMatch(/@@unique/);
    }
  });
});
