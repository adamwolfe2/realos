import type { Metadata } from "next";
import { ApiUsageStatus } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { microCentsToUsd } from "@/lib/cost-tracker/log";
import { getMonthToDateSpend } from "@/lib/cost-tracker/cap";

export const metadata: Metadata = { title: "API costs" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/costs — agency-wide cost-tracking dashboard.
//
// Adam 2026-05-29: "I'm not sure where these fees are going. I can't
// track it all! It would be very helpful to have on the admin page a
// way to track all the costs for all the organizations and properties,
// and API costs and Tavily costs and Perplexity costs and all of our
// APIs."
//
// Surfaces:
//   * Headline tiles — month-to-date / 7-day / 24-hour total spend
//   * Per-provider rollup (today + 7d + MTD)
//   * Per-org rollup (MTD), top 10
//   * Most expensive prospect audits (MTD), top 10
//   * Configured caps + current utilization
//   * 50 most recent calls (audit log)
//
// All numbers come from the ApiUsage table — no third-party billing
// API calls. Costs are computed from each provider's known rate card
// at log time (see lib/cost-tracker/log.ts + per-wrapper instrumentation).
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function readUsdCap(key: string, fallback: number | null): number | null {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default async function AdminCostsPage() {
  await requireAgency();

  const monthStart = startOfMonthUtc();
  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  // Fan out every query the page needs in parallel — single round-trip
  // to Postgres for the whole rollup. Group-by queries are cheap with
  // the indexes we added in the migration.
  const [
    mtdSpend,
    last7dByProvider,
    last24hByProvider,
    perOrgMtd,
    perAuditMtd,
    recentCalls,
  ] = await Promise.all([
    getMonthToDateSpend(),
    prisma.apiUsage.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since7d } },
      _sum: { costMicroCents: true },
      _count: { _all: true },
    }),
    prisma.apiUsage.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since24h } },
      _sum: { costMicroCents: true },
      _count: { _all: true },
    }),
    prisma.apiUsage.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: monthStart }, orgId: { not: null } },
      _sum: { costMicroCents: true },
      _count: { _all: true },
      orderBy: { _sum: { costMicroCents: "desc" } },
      take: 10,
    }),
    prisma.apiUsage.groupBy({
      by: ["prospectAuditId"],
      where: {
        createdAt: { gte: monthStart },
        prospectAuditId: { not: null },
      },
      _sum: { costMicroCents: true },
      _count: { _all: true },
      orderBy: { _sum: { costMicroCents: "desc" } },
      take: 10,
    }),
    prisma.apiUsage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        provider: true,
        endpoint: true,
        status: true,
        costMicroCents: true,
        orgId: true,
        prospectAuditId: true,
        durationMs: true,
        createdAt: true,
      },
    }),
  ]);

  // Hydrate org names + audit domains for the rollup tables.
  const orgIds = perOrgMtd.map((r) => r.orgId).filter((id): id is string => !!id);
  const auditIds = perAuditMtd
    .map((r) => r.prospectAuditId)
    .filter((id): id is string => !!id);

  const [orgs, audits] = await Promise.all([
    orgIds.length
      ? prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
    auditIds.length
      ? prisma.prospectAudit.findMany({
          where: { id: { in: auditIds } },
          select: { id: true, domain: true, brandName: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  const orgsById = new Map(orgs.map((o) => [o.id, o]));
  const auditsById = new Map(audits.map((a) => [a.id, a]));

  // Cap configuration.
  const globalCap = readUsdCap("COST_MONTHLY_CAP_USD", 200);
  const perProviderCaps: Array<{ provider: string; cap: number | null }> = [
    "dataforseo",
    "tavily",
    "anthropic",
    "openai",
    "perplexity",
    "gemini",
  ].map((p) => ({
    provider: p,
    cap: readUsdCap(`COST_MONTHLY_CAP_${p.toUpperCase()}`, null),
  }));

  // 24h + 7d totals from the raw rollup arrays.
  const total24hUsd = sumProviderRollup(last24hByProvider);
  const total7dUsd = sumProviderRollup(last7dByProvider);

  return (
    <div className="space-y-8">
      <PageHeader
        title="API costs"
        description="Per-provider, per-org, per-audit cost rollups across every upstream API call."
      />

      {/* Headline tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CostTile
          label="Last 24 hours"
          usd={total24hUsd}
          accent="#2563EB"
        />
        <CostTile
          label="Last 7 days"
          usd={total7dUsd}
          accent="#2563EB"
        />
        <CostTile
          label="Month to date"
          usd={mtdSpend.totalUsd}
          accent="#2563EB"
          subline={globalCap != null ? `of $${globalCap.toFixed(0)} cap` : null}
        />
        <CapStatus
          mtdUsd={mtdSpend.totalUsd}
          capUsd={globalCap}
        />
      </div>

      {/* Per-provider rollup */}
      <section className="rounded-xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid #E5E7EB" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
            By provider
          </h2>
          <span
            className="text-xs"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            sorted by month-to-date spend
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{
                color: "#6B7280",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <th className="px-5 py-2.5 font-medium">Provider</th>
              <th className="px-5 py-2.5 text-right font-medium">24h</th>
              <th className="px-5 py-2.5 text-right font-medium">7d</th>
              <th className="px-5 py-2.5 text-right font-medium">MTD</th>
              <th className="px-5 py-2.5 text-right font-medium">Cap</th>
            </tr>
          </thead>
          <tbody>
            {buildProviderRows(
              mtdSpend.perProvider,
              last7dByProvider,
              last24hByProvider,
              perProviderCaps,
            ).map((row) => (
              <tr key={row.provider} style={{ borderTop: "1px solid #F3F4F6" }}>
                <td
                  className="px-5 py-3 font-medium"
                  style={{ color: "#1E2A3A" }}
                >
                  {row.provider}
                </td>
                <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#6B7280" }}>
                  ${row.usd24h.toFixed(2)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#6B7280" }}>
                  ${row.usd7d.toFixed(2)}
                </td>
                <td
                  className="px-5 py-3 text-right tabular-nums font-semibold"
                  style={{ color: "#1E2A3A" }}
                >
                  ${row.usdMtd.toFixed(2)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#6B7280" }}>
                  {row.cap != null ? `$${row.cap.toFixed(0)}` : "—"}
                </td>
              </tr>
            ))}
            {Object.keys(mtdSpend.perProvider).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-sm"
                  style={{ color: "#9CA3AF" }}
                >
                  No usage logged yet. Provider wrappers start logging after
                  the next deploy carries the migration.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {/* Per-org + per-audit two-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid #E5E7EB" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
              Top 10 orgs · MTD
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left"
                style={{
                  color: "#6B7280",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <th className="px-5 py-2.5 font-medium">Org</th>
                <th className="px-5 py-2.5 text-right font-medium">Calls</th>
                <th className="px-5 py-2.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {perOrgMtd.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: "#9CA3AF" }}
                  >
                    No tenant calls logged yet.
                  </td>
                </tr>
              ) : (
                perOrgMtd.map((row) => {
                  const org = row.orgId ? orgsById.get(row.orgId) : null;
                  return (
                    <tr key={row.orgId} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td className="px-5 py-3" style={{ color: "#1E2A3A" }}>
                        {org ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{org.name}</span>
                            <span
                              className="text-[11px]"
                              style={{
                                color: "#9CA3AF",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {org.slug}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>(deleted)</span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 text-right tabular-nums"
                        style={{ color: "#6B7280" }}
                      >
                        {row._count._all}
                      </td>
                      <td
                        className="px-5 py-3 text-right tabular-nums font-semibold"
                        style={{ color: "#1E2A3A" }}
                      >
                        ${microCentsToUsd(row._sum.costMicroCents ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid #E5E7EB" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
              Top 10 prospect audits · MTD
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left"
                style={{
                  color: "#6B7280",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <th className="px-5 py-2.5 font-medium">Audit</th>
                <th className="px-5 py-2.5 text-right font-medium">Calls</th>
                <th className="px-5 py-2.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {perAuditMtd.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: "#9CA3AF" }}
                  >
                    No prospect audits logged yet.
                  </td>
                </tr>
              ) : (
                perAuditMtd.map((row) => {
                  const audit = row.prospectAuditId
                    ? auditsById.get(row.prospectAuditId)
                    : null;
                  return (
                    <tr
                      key={row.prospectAuditId}
                      style={{ borderTop: "1px solid #F3F4F6" }}
                    >
                      <td className="px-5 py-3" style={{ color: "#1E2A3A" }}>
                        {audit ? (
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {audit.brandName ?? audit.domain}
                            </span>
                            <span
                              className="text-[11px]"
                              style={{
                                color: "#9CA3AF",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {audit.domain} · {audit.status}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>(deleted)</span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 text-right tabular-nums"
                        style={{ color: "#6B7280" }}
                      >
                        {row._count._all}
                      </td>
                      <td
                        className="px-5 py-3 text-right tabular-nums font-semibold"
                        style={{ color: "#1E2A3A" }}
                      >
                        ${microCentsToUsd(row._sum.costMicroCents ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Recent calls audit log */}
      <section className="rounded-xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
        <div
          className="px-5 py-3"
          style={{ borderBottom: "1px solid #E5E7EB" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
            Recent calls
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left"
              style={{
                color: "#6B7280",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <th className="px-5 py-2.5 font-medium">When</th>
              <th className="px-5 py-2.5 font-medium">Provider</th>
              <th className="px-5 py-2.5 font-medium">Endpoint</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">ms</th>
              <th className="px-5 py-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recentCalls.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-sm"
                  style={{ color: "#9CA3AF" }}
                >
                  No calls yet — instrumentation lands with the next deploy.
                </td>
              </tr>
            ) : (
              recentCalls.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td
                    className="px-5 py-2.5 text-xs whitespace-nowrap"
                    style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
                  >
                    {formatRelative(row.createdAt)}
                  </td>
                  <td className="px-5 py-2.5 text-xs font-medium" style={{ color: "#1E2A3A" }}>
                    {row.provider}
                  </td>
                  <td
                    className="px-5 py-2.5 text-xs"
                    style={{ color: "#1E2A3A", fontFamily: "var(--font-mono)" }}
                  >
                    {row.endpoint}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusChip status={row.status} />
                  </td>
                  <td
                    className="px-5 py-2.5 text-xs text-right tabular-nums"
                    style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
                  >
                    {row.durationMs ?? "—"}
                  </td>
                  <td
                    className="px-5 py-2.5 text-xs text-right tabular-nums font-semibold"
                    style={{ color: "#1E2A3A", fontFamily: "var(--font-mono)" }}
                  >
                    ${microCentsToUsd(row.costMicroCents).toFixed(5)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function CostTile({
  label,
  usd,
  accent,
  subline,
}: {
  label: string;
  usd: number;
  accent: string;
  subline?: string | null;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <p
        className="text-[11px] font-mono uppercase tracking-[0.14em]"
        style={{ color: "#6B7280" }}
      >
        {label}
      </p>
      <p
        className="text-3xl font-semibold tabular-nums mt-1"
        style={{ color: "#1E2A3A" }}
      >
        ${usd.toFixed(2)}
      </p>
      {subline ? (
        <p
          className="text-[11px] mt-1"
          style={{ color: accent, fontFamily: "var(--font-mono)" }}
        >
          {subline}
        </p>
      ) : null}
    </div>
  );
}

function CapStatus({
  mtdUsd,
  capUsd,
}: {
  mtdUsd: number;
  capUsd: number | null;
}) {
  if (capUsd == null) {
    return (
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "#E5E7EB" }}
      >
        <p
          className="text-[11px] font-mono uppercase tracking-[0.14em]"
          style={{ color: "#6B7280" }}
        >
          Monthly cap
        </p>
        <p className="text-base mt-1" style={{ color: "#9CA3AF" }}>
          Not configured
        </p>
        <p
          className="text-[11px] mt-1"
          style={{ color: "#9CA3AF" }}
        >
          Set COST_MONTHLY_CAP_USD env to enforce
        </p>
      </div>
    );
  }
  const utilization = capUsd > 0 ? Math.min(1, mtdUsd / capUsd) : 0;
  const pct = utilization * 100;
  const color =
    utilization >= 0.9
      ? "#B91C1C"
      : utilization >= 0.7
        ? "#B45309"
        : "#2563EB";
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <p
        className="text-[11px] font-mono uppercase tracking-[0.14em]"
        style={{ color: "#6B7280" }}
      >
        Global cap
      </p>
      <p
        className="text-2xl font-semibold tabular-nums mt-1"
        style={{ color }}
      >
        {pct.toFixed(0)}%
      </p>
      <div
        className="mt-2 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p
        className="text-[11px] mt-2"
        style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
      >
        ${mtdUsd.toFixed(2)} of ${capUsd.toFixed(0)}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: ApiUsageStatus }) {
  const styles: Record<ApiUsageStatus, { bg: string; color: string }> = {
    [ApiUsageStatus.SUCCESS]: { bg: "rgba(22,163,74,0.10)", color: "#15803D" },
    [ApiUsageStatus.ERROR]: { bg: "rgba(185,28,28,0.10)", color: "#B91C1C" },
    [ApiUsageStatus.SKIPPED_CAP]: {
      bg: "rgba(180,83,9,0.10)",
      color: "#B45309",
    },
  };
  const style = styles[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumProviderRollup(
  rows: Array<{ _sum: { costMicroCents: number | null } }>,
): number {
  let total = 0;
  for (const r of rows) total += r._sum.costMicroCents ?? 0;
  return microCentsToUsd(total);
}

function buildProviderRows(
  mtd: Record<string, number>,
  last7d: Array<{ provider: string; _sum: { costMicroCents: number | null } }>,
  last24h: Array<{ provider: string; _sum: { costMicroCents: number | null } }>,
  caps: Array<{ provider: string; cap: number | null }>,
): Array<{
  provider: string;
  usd24h: number;
  usd7d: number;
  usdMtd: number;
  cap: number | null;
}> {
  const map7d = new Map(
    last7d.map((r) => [r.provider, microCentsToUsd(r._sum.costMicroCents ?? 0)]),
  );
  const map24h = new Map(
    last24h.map((r) => [r.provider, microCentsToUsd(r._sum.costMicroCents ?? 0)]),
  );
  const capByProvider = new Map(caps.map((c) => [c.provider, c.cap]));
  return Object.entries(mtd)
    .map(([provider, usdMtd]) => ({
      provider,
      usd24h: map24h.get(provider) ?? 0,
      usd7d: map7d.get(provider) ?? 0,
      usdMtd,
      cap: capByProvider.get(provider) ?? null,
    }))
    .sort((a, b) => b.usdMtd - a.usdMtd);
}

function formatRelative(d: Date): string {
  const deltaMs = Date.now() - d.getTime();
  const secs = Math.floor(deltaMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
