// Static reference to the seeded demo tenant. Built by prisma/seed.ts and
// (optionally) hydrated by scripts/seed-telegraph-commons.ts.
//
// We keep this as a constant rather than looking it up at test time because:
//  1. The middleware resolves tenants by hostname, not slug, so we still
//     need to set the Host header on every request.
//  2. The org id is stable across re-seeds via upsert on slug.
//  3. Network round-trips before each test would slow the suite for no win.
//
// If your local DB doesn't have telegraph-commons seeded, run:
//   set -a && source .env.local && set +a && pnpm db:seed

export const TEST_TENANT = {
  slug: "telegraph-commons",
  // Subdomain on the configured platform domain. Middleware resolves
  // {slug}.{NEXT_PUBLIC_PLATFORM_DOMAIN} -> the matching Organization.
  hostname: "telegraph-commons.leasestack.co",
} as const;

// Lazily resolved at test setup time so we don't ship a hardcoded id that
// silently goes stale. See e2e/helpers/tenant.ts.
export type TenantHandle = {
  orgId: string;
  slug: string;
  hostname: string;
};
