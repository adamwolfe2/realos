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
  "lib/seo/agent.ts":
    "internal recommendation engine — orgId/propertyId are plain params, always sourced from an already-scoped caller (portal page, refresh route's tenantWhere+allowedPropertyIds check) or a verifyCronAuth-/requireAdmin-gated job that intentionally scans every org",
  "lib/seo/agent-charts-data.ts":
    "internal chart-data aggregators — orgId/propertyId plain params sourced from app/portal/seo/agent/page.tsx after it resolves property.id via marketablePropertyWhere(scope.orgId) + scope.allowedPropertyIds",
  "lib/seo/aggregate-fact-table.ts":
    "runFactTableAggregation() takes no external tenant input — it self-selects every LIVE property via its own prisma.property.findMany; invoked only by the verifyCronAuth-gated seo-fact-aggregate cron, cross-tenant by design",
  "lib/seo/score-snapshot.ts":
    "weekly score snapshot writer — orgId/propertyId plain params sourced from the seo-fact-aggregate cron's own property.findMany loop (verifyCronAuth-gated), cross-tenant by design",
  "lib/seo/sync-orchestrator.ts":
    "DataforSEO sync orchestrator — validates propertyId belongs to orgId via prisma.property.findFirst before mutating; invoked only by verifyCronAuth-gated cron routes that intentionally iterate every org's properties",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTenantModelBody(body: string): boolean {
  const hasOrgId = /^\s*orgId\s+String\b/m.test(body);
  const hasOrganizationId = /^\s*organizationId\s+String\b/m.test(body);
  return hasOrgId || hasOrganizationId;
}

/**
 * Extract every `model Name { ... }` block from schema.prisma by brace
 * depth, not a `[^}]*` regex. The regex version truncates at the FIRST `}`
 * in the body — which happens routinely (Json `@default("{}")`, doc
 * comments showing a JSON shape) — silently shrinking the body the
 * orgId/organizationId check runs against. Verified against the current
 * schema: 21 models truncate under the old regex (e.g. Organization's
 * 17KB body collapses to 153 chars); the tenant list still came out right
 * only because orgId happened to appear before the first stray `}` in
 * every case. That's luck, not correctness — the >20 floor below can't
 * catch a single dropped model either.
 */
function tenantModelAccessors(): string[] {
  const schemaSrc = fs.readFileSync(
    path.join(ROOT, "prisma/schema.prisma"),
    "utf-8"
  );
  const modelStartRe = /^model\s+(\w+)\s*\{\s*$/gm;
  const accessors: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelStartRe.exec(schemaSrc))) {
    const name = match[1];
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let i = bodyStart;
    while (depth > 0 && i < schemaSrc.length) {
      const ch = schemaSrc[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const body = schemaSrc.slice(bodyStart, i - 1);
    if (isTenantModelBody(body)) {
      accessors.push(name[0].toLowerCase() + name.slice(1));
    }
  }
  return accessors;
}

/**
 * Independent cross-check for the self-check test below: a line-based scan
 * (model body ends at the first line that is *exactly* `}`) instead of
 * brace-depth counting. Deliberately a different algorithm so the two
 * can't share a bug — if they disagree, the schema has a shape neither
 * parser expects and the lint should fail loudly instead of guessing.
 */
function tenantModelAccessorsLineScan(): string[] {
  const schemaSrc = fs.readFileSync(
    path.join(ROOT, "prisma/schema.prisma"),
    "utf-8"
  );
  const lines = schemaSrc.split("\n");
  const accessors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^model\s+(\w+)\s*\{\s*$/.exec(lines[i]);
    if (!m) continue;
    const bodyLines: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "}") break;
      bodyLines.push(lines[j]);
    }
    if (isTenantModelBody(bodyLines.join("\n"))) {
      accessors.push(m[1][0].toLowerCase() + m[1].slice(1));
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

  it("includes known tenant models and agrees with an independently-implemented parser", () => {
    // Known-good floor: these must always show up, regardless of parser
    // internals. Catches a silent drop that a bare length check can't.
    const mustInclude = [
      "property",
      "lead",
      "seoSnapshot",
      "seoActionRecommendation",
      "chatbotEngagement",
    ];
    for (const name of mustInclude) {
      expect(tenantModels, `expected "${name}" in tenant model list`).toContain(
        name
      );
    }

    // Cross-check against a second, differently-implemented scan (line-based
    // instead of brace-depth-based). Any disagreement means one of the two
    // parsers is misreading schema.prisma's current shape.
    const independent = tenantModelAccessorsLineScan();
    expect(independent.sort()).toEqual([...tenantModels].sort());
  });

  const callRe = new RegExp(
    `\\bprisma\\.(${tenantModels.map(escapeRegex).join("|")})\\.(${MUTATING_METHODS.join("|")})\\s*\\(`,
    "g"
  );

  const candidateFiles = [
    ...glob.sync("app/api/tenant/**/*.ts", { cwd: ROOT }),
    ...glob.sync("lib/actions/**/*.ts", { cwd: ROOT }),
    // Portal server components query prisma directly (no route/action
    // layer in between) — the app/portal/seo/page.tsx property-scope leak
    // that shipped in this same batch is exactly the shape this closes.
    ...glob.sync("app/portal/**/page.tsx", { cwd: ROOT }),
    ...glob.sync("lib/seo/**/*.ts", { cwd: ROOT }),
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
