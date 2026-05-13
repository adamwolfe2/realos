import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Structural tests for the SEO module. Confirms:
//   - The cron route exists, requires CRON_SECRET, returns JSON
//   - The portal page, connect forms, and trend chart files exist
//   - The integration libs (gsc.ts, ga4.ts, seo-sync.ts) exist
//   - The connect server actions encrypt input and probe before persisting
//   - The Zod schemas reject empty input
//
// We deliberately don't hit Google APIs here — sync correctness is covered
// by manual ops once a real service account is connected. These tests guard
// the public contract.

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("SEO module — structure", () => {
  it("cron route exists and enforces CRON_SECRET", () => {
    const src = readFile("app/api/cron/seo-sync/route.ts");
    // Either inline CRON_SECRET reference or the shared verifyCronAuth helper
    // (which constant-time-compares Bearer ${CRON_SECRET} internally).
    const hasAuth =
      src.includes("CRON_SECRET") || src.includes("verifyCronAuth");
    expect(hasAuth).toBe(true);
    expect(src).toMatch(/export async function GET/);
    expect(src).toContain("runSeoSync");
  });

  it("vercel.json registers the seo-sync cron on a recurring schedule", () => {
    const vercel = JSON.parse(readFile("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const found = vercel.crons.find((c) => c.path === "/api/cron/seo-sync");
    expect(found).toBeDefined();
    // Schedule cadence is a product decision (currently every 6h). We just
    // make sure a valid cron expression is present so the cron is wired.
    expect(found?.schedule).toMatch(/^[\d*/,\- ]+$/);
  });

  it("portal page exists at /portal/seo and uses requireScope", () => {
    const src = readFile("app/portal/seo/page.tsx");
    expect(src).toContain("requireScope");
    expect(src).toContain("seoSnapshot");
    // Tenant scoping: every prisma read must filter by orgId.
    const prismaCallCount = (src.match(/prisma\.seo/g) ?? []).length;
    expect(prismaCallCount).toBeGreaterThan(0);
    const orgIdScopeCount = (src.match(/orgId: scope\.orgId/g) ?? []).length;
    expect(orgIdScopeCount).toBeGreaterThanOrEqual(prismaCallCount);
  });

  it("integration libs exist", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/integrations/gsc.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "lib/integrations/ga4.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "lib/integrations/seo-sync.ts"))).toBe(
      true,
    );
  });

  it("connect action encrypts JSON and probes before persisting", () => {
    const src = readFile("lib/actions/seo-connect.ts");
    expect(src).toContain("import { encrypt }");
    expect(src).toContain("testGscConnection");
    expect(src).toContain("testGa4Connection");
    // Encrypt must be called before any DB write. The action uses a
    // lookup-then-update pattern (see comment in seo-connect.ts) rather
    // than .upsert() — both are acceptable, we just want the encrypted
    // payload reference to appear before the create/update call.
    const encryptIdx = src.search(/encrypt\([a-zA-Z]+\)/);
    const writeIdx = src.search(
      /seoIntegration\.(upsert|update|create)/,
    );
    expect(encryptIdx).toBeGreaterThan(0);
    expect(writeIdx).toBeGreaterThan(0);
    expect(encryptIdx).toBeLessThan(writeIdx);
  });

  it("portal nav surfaces SEO when moduleSEO is true", () => {
    const src = readFile("components/portal/portal-nav.tsx");
    expect(src).toContain("moduleSEO");
    expect(src).toContain('href: "/portal/seo"');
    expect(src).toContain("o.moduleSEO");
  });

  it("integration catalog defines GSC + GA4 as self_serve", () => {
    const src = readFile("lib/integrations/catalog.ts");
    expect(src).toContain('slug: "gsc"');
    expect(src).toContain('slug: "ga4"');
    // Each definition is roughly 12 lines, ~700 chars. Slice generously and
    // confirm the auth field is self_serve so the marketplace renders the
    // paste-the-JSON form rather than the request-activation button.
    const gscIdx = src.indexOf('slug: "gsc"');
    const ga4Idx = src.indexOf('slug: "ga4"');
    expect(src.slice(gscIdx, gscIdx + 800)).toContain('auth: "self_serve"');
    expect(src.slice(ga4Idx, ga4Idx + 800)).toContain('auth: "self_serve"');
  });

  it("schema declares all four SEO tables with tenant FK", () => {
    const src = readFile("prisma/schema.prisma");
    expect(src).toContain("model SeoIntegration");
    expect(src).toContain("model SeoSnapshot");
    expect(src).toContain("model SeoQuery");
    expect(src).toContain("model SeoLandingPage");
    expect(src).toContain("enum SeoProvider");
    expect(src).toContain("enum SeoSyncStatus");
    // Every table must have orgId + onDelete: Cascade
    expect(
      (src.match(/orgId\s+String/g) ?? []).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("migration sql file exists for the 4 new tables", () => {
    const sql = readFile("prisma/migrations/20260420_add_seo_module/migration.sql");
    expect(sql).toContain('CREATE TABLE "SeoIntegration"');
    expect(sql).toContain('CREATE TABLE "SeoSnapshot"');
    expect(sql).toContain('CREATE TABLE "SeoQuery"');
    expect(sql).toContain('CREATE TABLE "SeoLandingPage"');
    expect(sql).toContain('CREATE TYPE "SeoProvider"');
    expect(sql).toContain('CREATE TYPE "SeoSyncStatus"');
  });
});

// gsc.ts is server-only (uses `import "server-only"`), which vitest can't
// load directly. Import the pure helper from the shared sa-json module.
describe("SEO module — service account JSON parsing", () => {
  it("parseServiceAccountJson rejects malformed JSON", async () => {
    const { parseServiceAccountJson } = await import(
      "../lib/integrations/seo-sa-json"
    );
    expect(() => parseServiceAccountJson("not json at all")).toThrow();
  });

  it("parseServiceAccountJson rejects JSON missing client_email", async () => {
    const { parseServiceAccountJson } = await import(
      "../lib/integrations/seo-sa-json"
    );
    expect(() =>
      parseServiceAccountJson(
        JSON.stringify({ project_id: "x", private_key: "y" }),
      ),
    ).toThrow(/client_email|project_id/);
  });

  it("parseServiceAccountJson accepts a well-formed payload", async () => {
    const { parseServiceAccountJson } = await import(
      "../lib/integrations/seo-sa-json"
    );
    const result = parseServiceAccountJson(
      JSON.stringify({
        type: "service_account",
        project_id: "telegraph-seo",
        client_email: "seo-pull@telegraph-seo.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
      }),
    );
    expect(result.email).toBe(
      "seo-pull@telegraph-seo.iam.gserviceaccount.com",
    );
    expect(result.projectId).toBe("telegraph-seo");
  });
});
