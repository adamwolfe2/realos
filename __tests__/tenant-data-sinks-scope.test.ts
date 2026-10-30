import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildSummaries, EMPTY_ROLLUP } from "@/lib/admin/data-sinks-helpers";
import { EMPTY_AGG } from "@/lib/admin/data-sinks-aggregators";

const now = new Date();
const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

// Platform-wide crons erroring because of some OTHER org (the demo org's
// missing ad credentials, Firecrawl out of credits).
const failingCron = {
  ...EMPTY_ROLLUP,
  runsLast24h: 24,
  errorsLast24h: 24,
  consecutiveRecentErrors: 24,
  lastRunAt: now,
  lastErrorAt: now,
  lastErrorMessage: "org cmp76brh: no credentials configured",
};

function build(tenantScoped: boolean, appfolio = EMPTY_AGG, siteIntel: Date | null = null) {
  const crons = new Map(
    ["appfolio-sync", "ads-sync", "seo-sync", "site-intelligence-refresh"].map(
      (j) => [j, failingCron],
    ),
  );
  const out = buildSummaries({
    cronRollups: crons,
    appfolio,
    ga4: EMPTY_AGG,
    gsc: EMPTY_AGG,
    googleAds: EMPTY_AGG,
    metaAds: EMPTY_AGG,
    reputationTenants: null,
    aeoTenants: null,
    siteIntelTenants: siteIntel ? 1 : 0,
    perTenantOverrides: {
      reputationLastRunAt: null,
      aeoLastRunAt: null,
      siteIntelLastRunAt: siteIntel,
    },
    tenantScoped,
  });
  return Object.fromEntries(out.map((s) => [s.provider, s]));
}

describe("tenant-scoped data sinks", () => {
  it("platform view still surfaces cron failures", () => {
    expect(build(false).google_ads.status).toBe("dead");
  });

  it("another org's cron errors never show on a client page", () => {
    const s = build(true, { ...EMPTY_AGG, lastSyncAt: now, tenantsCovered: 1 });
    expect(s.appfolio.status).toBe("fresh");
    expect(s.appfolio.lastErrorMessage).toBeNull();
    expect(s.google_ads.status).toBe("missing");
    expect(s.meta_ads.status).toBe("missing");
  });

  it("this org's own failed sync is erroring", () => {
    const s = build(true, {
      lastSyncAt: now,
      lastErrorAt: now,
      lastErrorMessage: "bad creds",
      tenantsCovered: 1,
    });
    expect(s.appfolio.status).toBe("erroring");
    expect(s.appfolio.lastErrorMessage).toBe("bad creds");
  });

  it("a stale site crawl is flagged on its own crawl date", () => {
    expect(build(true, EMPTY_AGG, old).site_intelligence.status).toBe("dead");
    expect(build(true, EMPTY_AGG, now).site_intelligence.status).toBe("fresh");
  });
});
