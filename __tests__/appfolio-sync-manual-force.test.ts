import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression test for ADMIN-OPS-D001: the "Run sync now" admin action fires
// GET /api/cron/appfolio-sync (same handler Vercel Cron uses on schedule).
// Without a force override, an integration whose lastSyncAt is still inside
// its cadence window gets silently skipped — `results[].skipped: true` — but
// the endpoint still returns `ok: true` overall, indistinguishable from a
// real run to whoever clicked the button. `?force=true` must bypass the
// cadence check so an explicit manual trigger always does real work.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  runAppfolioSync: vi.fn(),
  db: {
    appFolioIntegration: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (
    _name: string,
    job: () => Promise<{ result: unknown }>,
  ) => (await job()).result,
}));
vi.mock("@/lib/observability/cron-tracker", () => ({
  trackCronDuration: async (_name: string, handler: () => Promise<unknown>) =>
    handler(),
}));
vi.mock("@/lib/integrations/appfolio-sync", () => ({
  runAppfolioSync: h.runAppfolioSync,
}));
vi.mock("@/lib/integrations/appfolio", () => ({
  syncListingsForOrg: vi.fn(),
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: () => {} }));

import { GET } from "@/app/api/cron/appfolio-sync/route";

const RECENTLY_SYNCED_INTEGRATION = {
  orgId: "org_1",
  clientIdEncrypted: "enc_id",
  clientSecretEncrypted: "enc_secret",
  apiKeyEncrypted: null,
  syncFrequencyMinutes: 30,
  // Synced 5 minutes ago — well inside the 30-minute cadence window.
  lastSyncAt: new Date(Date.now() - 5 * 60 * 1000),
  lastSyncStats: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.db.appFolioIntegration.updateMany.mockResolvedValue({ count: 0 });
  h.db.appFolioIntegration.findMany.mockResolvedValue([
    RECENTLY_SYNCED_INTEGRATION,
  ]);
  h.db.appFolioIntegration.count.mockResolvedValue(1);
  h.db.appFolioIntegration.findUnique.mockResolvedValue(
    RECENTLY_SYNCED_INTEGRATION,
  );
  h.runAppfolioSync.mockResolvedValue({ ok: true, stats: {} });
});

describe("appfolio-sync cron — manual force override", () => {
  it("skips an integration still inside its cadence window by default", async () => {
    const res = await GET(
      new Request("https://x/api/cron/appfolio-sync") as never,
    );
    const json = await (res as Response).json();

    expect(h.runAppfolioSync).not.toHaveBeenCalled();
    expect(json.results).toEqual([
      expect.objectContaining({ orgId: "org_1", ok: true, skipped: true }),
    ]);
  });

  it("forces a real run for the same integration when force=true", async () => {
    const res = await GET(
      new Request("https://x/api/cron/appfolio-sync?force=true") as never,
    );
    const json = await (res as Response).json();

    expect(h.runAppfolioSync).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ retrySkipped: expect.any(Boolean) }),
    );
    expect(json.results).toEqual([
      expect.objectContaining({ orgId: "org_1", ok: true }),
    ]);
    expect(json.results[0].skipped).toBeUndefined();
  });
});
