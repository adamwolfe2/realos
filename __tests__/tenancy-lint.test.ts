import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Tenancy lint — structural check for the recurring bug class in this repo:
 * a Prisma query on a tenant-scoped model that forgets to apply org/property
 * scoping. Shipped (and got fixed) four separate times:
 *
 *   1. updateProperty property-level IDOR — lib/actions/properties.ts,
 *      fixed alongside the wave-3 review batch (see
 *      AUTONOMOUS_IMPROVEMENT_LOG.md "updateProperty IDOR").
 *   2. createReport missing allowedPropertyIds check — commit 3eaffa94
 *      "fix(reports): enforce property-scope RBAC on every report surface".
 *   3. reputation routes missing allowedPropertyIds guards — commit
 *      7441c6ea "test: lock in property-scope gates on reputation-mentions
 *      routes" (audit P1-2).
 *   4. leads/export property-scope intersection — commit 95b6fafd
 *      "test: cover property-scope intersection on GET /api/tenant/leads/export",
 *      part of the same 8b0f04e9 single-record-endpoint sweep.
 *
 * This is a text/regex scan, not an AST project: it proves a file *mentions*
 * tenant-scoping infrastructure, not that the scoping is applied correctly
 * to every call. That's the tradeoff for staying fast and dependency-free —
 * it catches "forgot scoping entirely," not "scoped org but not property."
 * Per-function granularity would be more precise but fragile against
 * reformatting; per-file is the robust choice here.
 */

const ROOT = path.resolve(__dirname, "..");

const MUTATING_METHODS = [
  "findMany",
  "findFirst",
  "findUnique",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "create",
  "createMany",
  "upsert",
];

// Sanctioned scoping helpers actually present in the repo (verified against
// lib/tenancy/scope.ts, lib/tenancy/property-filter.ts, lib/reports/access.ts,
// lib/properties/marketable.ts). A file is also considered scoped if it
// inlines the ScopedContext fields directly (scope.orgId / .actualOrgId /
// .allowedPropertyIds) instead of going through a named helper — that's the
// dominant pattern in lib/actions/** and is just as safe.
const HELPER_RE =
  /\b(tenantWhere|propertyInScope|propertyWhereFragment|canAccessReport|marketablePropertyWhere)\b/;
const INLINE_SCOPE_RE = /\bscope\.(orgId|actualOrgId|allowedPropertyIds)\b/;

// Allowlist: exact-match relative file paths (posix, from repo root) that
// touch a tenant model without referencing a sanctioned helper, plus why
// that's fine today. Keep entries exact — a new violation in one of these
// files still needs its own review; this list is not a directory wildcard.
const ALLOWLIST: Record<string, string> = {
  "app/api/tenant/listings/route.ts":
    "public unauthenticated marketing endpoint — org resolved from readTenantHeaders() (middleware-set x-tenant-org-id), not an authenticated ScopedContext",
  "lib/actions/admin-appfolio.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/admin-cursive.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/admin-domains.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/admin-modules.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/bug-report-actions.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/convert-intake.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
  "lib/actions/create-client.ts":
    "agency admin action gated by requireAgency(); provisions a brand-new org, so there is no existing orgId to scope against yet",
  "lib/actions/pixel-requests.ts":
    "agency admin action gated by requireAgency(); operates on an explicit target orgId param by design (cross-tenant admin surface)",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tenantModelAccessors(): string[] {
  const schemaSrc = fs.readFileSync(
    path.join(ROOT, "prisma/schema.prisma"),
    "utf-8"
  );
  const modelBlockRe = /model\s+(\w+)\s*\{([^}]*)\}/g;
  const accessors: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelBlockRe.exec(schemaSrc))) {
    const [, name, body] = match;
    const hasOrgId = /^\s*orgId\s+String\b/m.test(body);
    const hasOrganizationId = /^\s*organizationId\s+String\b/m.test(body);
    if (hasOrgId || hasOrganizationId) {
      accessors.push(name[0].toLowerCase() + name.slice(1));
    }
  }
  return accessors;
}

function findTenantScopedCalls(content: string, callRe: RegExp): string[] {
  callRe.lastIndex = 0;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(content))) {
    found.push(`${m[1]}.${m[2]}`);
  }
  return found;
}

describe("tenancy lint — Prisma calls on tenant models must reference a scoping guard", () => {
  const tenantModels = tenantModelAccessors();

  it("derives a non-trivial tenant model list from schema.prisma", () => {
    // Guards against the scan silently matching nothing if the schema
    // convention (orgId String field) ever changes shape.
    expect(tenantModels.length).toBeGreaterThan(20);
  });

  const callRe = new RegExp(
    `\\bprisma\\.(${tenantModels.map(escapeRegex).join("|")})\\.(${MUTATING_METHODS.join("|")})\\s*\\(`,
    "g"
  );

  const candidateFiles = [
    ...glob.sync("app/api/tenant/**/*.ts", { cwd: ROOT }),
    ...glob.sync("lib/actions/**/*.ts", { cwd: ROOT }),
  ].sort();

  const filesWithTenantCalls = candidateFiles
    .map((relPath) => {
      const content = fs.readFileSync(path.join(ROOT, relPath), "utf-8");
      const calls = findTenantScopedCalls(content, callRe);
      return { relPath, content, calls };
    })
    .filter((f) => f.calls.length > 0);

  it("finds tenant-scoped Prisma calls under app/api/tenant/** and lib/actions/**", () => {
    // Sanity floor so a broken glob/regex doesn't silently pass an empty suite.
    expect(filesWithTenantCalls.length).toBeGreaterThan(20);
  });

  it("every allowlist entry exists and actually needs the exemption", () => {
    const knownFiles = new Set(filesWithTenantCalls.map((f) => f.relPath));
    for (const allowedPath of Object.keys(ALLOWLIST)) {
      expect(
        knownFiles.has(allowedPath),
        `allowlist entry "${allowedPath}" does not match a file with a tenant-model Prisma call — remove the stale entry`
      ).toBe(true);
    }
  });

  for (const { relPath, content, calls } of filesWithTenantCalls) {
    const allowlistReason = ALLOWLIST[relPath];

    it(
      allowlistReason
        ? `${relPath} — allowlisted (${allowlistReason})`
        : `${relPath} — references a sanctioned scoping guard (${calls.join(", ")})`,
      () => {
        if (allowlistReason) {
          // Allowlisted: presence recorded above, no scoping assertion.
          expect(allowlistReason.length).toBeGreaterThan(0);
          return;
        }
        const hasHelper = HELPER_RE.test(content);
        const hasInlineScope = INLINE_SCOPE_RE.test(content);
        expect(
          hasHelper || hasInlineScope,
          `${relPath} calls ${calls.join(", ")} on a tenant-scoped model but never references ` +
            `tenantWhere/propertyInScope/propertyWhereFragment/canAccessReport/marketablePropertyWhere ` +
            `nor scope.orgId/scope.actualOrgId/scope.allowedPropertyIds. Add the appropriate guard, or ` +
            `add an exact-match ALLOWLIST entry in __tests__/tenancy-lint.test.ts with a one-line reason.`
        ).toBe(true);
      }
    );
  }
});
