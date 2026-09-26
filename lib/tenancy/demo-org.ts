// Demo orgs (slug "*-demo", e.g. telegraph-commons-demo) are seeded fixtures
// with fake segment IDs and placeholder credentials. Background syncs must
// skip them: every run fails and pins the cron at "partial", which hides
// real customer failures. Same rule as the admin Demo badge.
export const DEMO_SLUG_SUFFIX = "-demo";

/** Prisma Organization where-fragment excluding demo orgs. */
export const notDemoOrg = {
  NOT: { slug: { endsWith: DEMO_SLUG_SUFFIX } },
} as const;
