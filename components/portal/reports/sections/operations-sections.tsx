import * as React from "react";
import type {
  ReportLifecycleStats,
  ReportOccupancyStats,
  ReportRenewalStats,
  ReportSnapshot,
  ReportVisitorStats,
} from "@/lib/reports/generate";
import {
  C,
  DeltaPill,
  Donut,
  KvLine,
  MiniStat,
  Section,
  TrendChart,
} from "@/components/portal/reports/sections/report-primitives";

export function OccupancySection({ stats }: { stats: ReportOccupancyStats }) {
  const occ = stats.occupancyPct ?? 0;
  return (
    <Section
      eyebrow="Live · AppFolio"
      title="Occupancy snapshot"
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-4">
        <Donut pct={occ} label={`${occ}%`} sublabel="Occupied" />
        <div className="space-y-1.5 text-[11px] min-w-0">
          <KvLine k="Leased" v={stats.leasedUnits.toLocaleString()} dot={C.primary} />
          <KvLine
            k="Available"
            v={stats.availableUnits.toLocaleString()}
            dot={C.primaryFaint}
          />
          <KvLine
            k="On notice"
            v={stats.onNotice.toLocaleString()}
            dot={C.muted}
          />
          <KvLine
            k="Apps queued"
            v={stats.applicationsQueued.toLocaleString()}
            dot={C.violet}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <MiniStat
          label="Monthly rent roll"
          value={`$${stats.monthlyRentRollUsd.toLocaleString()}`}
        />
        <MiniStat
          label="Avg rent / unit"
          value={
            stats.avgRentPerUnitUsd != null
              ? `$${stats.avgRentPerUnitUsd.toLocaleString()}`
              : "—"
          }
        />
      </div>
    </Section>
  );
}

export function RenewalSection({ stats }: { stats: ReportRenewalStats }) {
  return (
    <Section eyebrow="Next 120 days" title="Renewal pipeline">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <MiniStat
          label="Active leases"
          value={stats.activeLeases.toLocaleString()}
        />
        <MiniStat
          label="Expiring (120d)"
          value={stats.expiringNext120.toLocaleString()}
        />
        <MiniStat
          label="In 30 days"
          value={stats.expiringNext30.toLocaleString()}
        />
      </div>
      <div className="mt-3 rounded-[2px] border border-[#a6c8ff] bg-[#edf5ff]/60 p-3">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0043ce]">
            Monthly rent roll at risk
          </p>
          <span className="text-[18px] font-bold tabular-nums text-[#0043ce]">
            ${stats.monthlyAtRiskUsd.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-[#0043ce]/80">
          Cumulative rent across leases ending in the next 120 days.
        </p>
      </div>
      {stats.pastDueCount > 0 ? (
        <div className="mt-2 rounded-[2px] border border-primary bg-primary p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              Past-due
            </p>
            <span className="text-[14px] font-bold tabular-nums text-primary-foreground">
              {stats.pastDueCount} · $
              {stats.pastDueBalanceUsd.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

export function VisitorSection({ stats }: { stats: ReportVisitorStats }) {
  return (
    <Section
      className="ls-report-section"
      eyebrow="Pixel identification"
      title="Website visitors identified"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 items-center">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
          <MiniStat
            label="Identified"
            value={stats.identifiedVisitors.toLocaleString()}
          />
          <MiniStat
            label="New (period)"
            value={stats.identifiedNewInPeriod.toLocaleString()}
          />
          <MiniStat
            label="With email"
            value={stats.withEmail.toLocaleString()}
          />
          <MiniStat
            label="Matched lead"
            value={stats.identifiedWithLead.toLocaleString()}
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
            New identifications · daily
          </div>
          <TrendChart data={stats.identifiedTrend} compact />
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// VisitorIntelligenceSection — Norman May 22 fill-the-empty-space pass.
// Surfaces the full set of honest Visitor-table signals we have so
// Operations stops reading as "4 numbers + a sparkline + chatbot".
//
// Render layout (all rows skip themselves when their data is empty):
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Hot · 147     │ Outreach · 12   │ Google Ads · 80 │ Meta · 0 │
//   └──────────────────────────────────────────────────────────────┘
//   ┌─────────────────┬──────────────┬──────────────────┬────────────┐
//   │ Pixel funnel    │ Geography    │ Top referrers    │ Demographics│
//   │ ANON 30         │ Berkeley 88  │ telegraphcommons │ 25-34: 64% │
//   │ IDENT 147       │ Oakland 18   │ google.com 17    │ M 51/F 49  │
//   │ MATCHED 0       │ SF 12        │ direct 22        │            │
//   └─────────────────┴──────────────┴──────────────────┴────────────┘
//
// Every block is its own card so the section adapts when the org has
// partial enrichment data — Audience Lab regions vary in field
// coverage and we never want to ship "—" tiles.
// ---------------------------------------------------------------------------
export function VisitorIntelligenceSection({
  stats,
}: {
  stats: ReportVisitorStats;
}) {
  const hot = stats.hotCount ?? 0;
  const outreach = stats.outreachSentCount ?? 0;
  const google = stats.syncedToGoogleAds ?? 0;
  const meta = stats.syncedToMetaAds ?? 0;
  const headlineTiles: Array<{ label: string; value: string; hint?: string }> = [];
  if (hot > 0)
    headlineTiles.push({
      label: "Hot visitors",
      value: hot.toLocaleString(),
      hint: "Intent score ≥ 70",
    });
  if (outreach > 0)
    headlineTiles.push({
      label: "Outreach sent",
      value: outreach.toLocaleString(),
      hint: "Email/SMS engaged",
    });
  if (google > 0)
    headlineTiles.push({
      label: "Synced · Google Ads",
      value: google.toLocaleString(),
      hint: "Custom audience",
    });
  if (meta > 0)
    headlineTiles.push({
      label: "Synced · Meta Ads",
      value: meta.toLocaleString(),
      hint: "Custom audience",
    });

  const blocks: Array<{
    title: string;
    rows: Array<{ label: string; value: string | number }>;
  }> = [];
  if (stats.byStatus && stats.byStatus.length > 0) {
    const total = stats.byStatus.reduce((s, r) => s + r.count, 0) || 1;
    blocks.push({
      title: "Pixel funnel",
      rows: stats.byStatus.slice(0, 6).map((r) => ({
        label: humanStatus(r.status),
        value: `${r.count.toLocaleString()} · ${Math.round(
          (r.count / total) * 100,
        )}%`,
      })),
    });
  }
  if (stats.topCities && stats.topCities.length > 0) {
    blocks.push({
      title: "Top visitor cities",
      rows: stats.topCities.slice(0, 6).map((r) => ({
        label: r.city,
        value: r.count,
      })),
    });
  } else if (stats.topStates && stats.topStates.length > 0) {
    blocks.push({
      title: "Top visitor states",
      rows: stats.topStates.slice(0, 6).map((r) => ({
        label: r.state,
        value: r.count,
      })),
    });
  }
  if (stats.topReferrers && stats.topReferrers.length > 0) {
    blocks.push({
      title: "Top referrers",
      rows: stats.topReferrers.slice(0, 5).map((r) => ({
        label: r.referrer,
        value: r.count,
      })),
    });
  }
  if (
    (stats.ageRanges && stats.ageRanges.length > 0) ||
    (stats.genderSplit && stats.genderSplit.length > 0)
  ) {
    const rows: Array<{ label: string; value: string | number }> = [];
    if (stats.genderSplit && stats.genderSplit.length > 0) {
      const total =
        stats.genderSplit.reduce((s, r) => s + r.count, 0) || 1;
      for (const g of stats.genderSplit.slice(0, 3)) {
        rows.push({
          label: humanGender(g.gender),
          value: `${Math.round((g.count / total) * 100)}%`,
        });
      }
    }
    if (stats.ageRanges && stats.ageRanges.length > 0) {
      const total = stats.ageRanges.reduce((s, r) => s + r.count, 0) || 1;
      for (const a of stats.ageRanges.slice(0, 4)) {
        rows.push({
          label: a.ageRange,
          value: `${Math.round((a.count / total) * 100)}%`,
        });
      }
    }
    blocks.push({ title: "Audience demographics", rows });
  }

  if (headlineTiles.length === 0 && blocks.length === 0) return null;

  return (
    <Section
      className="ls-report-section"
      eyebrow="Audience intelligence · enriched by Cursive"
      title="Visitor intelligence"
    >
      {headlineTiles.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {headlineTiles.map((t) => (
            <div
              key={t.label}
              className="rounded-[2px] border border-primary/20 px-3 py-2.5"
              style={{ backgroundColor: "#edf5ff" }}
            >
              <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                {t.label}
              </p>
              <p className="mt-0.5 text-[22px] font-bold tabular-nums text-foreground leading-none">
                {t.value}
              </p>
              {t.hint ? (
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {t.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {blocks.length > 0 ? (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {blocks.map((b) => (
            <div
              key={b.title}
              className="rounded-[2px] border border-border bg-card p-3"
            >
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-1.5">
                {b.title}
              </div>
              <ul className="space-y-1">
                {b.rows.map((r, i) => (
                  <li
                    key={`${b.title}-${i}`}
                    className="flex items-baseline justify-between gap-2 text-[11.5px]"
                  >
                    <span className="text-foreground truncate font-medium">
                      {r.label}
                    </span>
                    <span className="tabular-nums text-foreground font-semibold shrink-0">
                      {typeof r.value === "number"
                        ? r.value.toLocaleString()
                        : r.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function humanStatus(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanGender(g: string): string {
  const x = g.toLowerCase();
  if (x === "m" || x === "male") return "Male";
  if (x === "f" || x === "female") return "Female";
  return humanStatus(g);
}

// ---------------------------------------------------------------------------
// LifecycleStrip — AppFolio lease + application counts pulled from the
// AppFolio mirror tables. Sits at the top of the Traffic & Leads tab
// so ownership sees the real pipeline number (e.g. "TC signed 20+
// leases this period") even when the form/chatbot Lead count is low.
// Norman bug May 22 — without this, every conversion stage past NEW
// read 0 because Lease rows weren't joined to Lead rows.
// ---------------------------------------------------------------------------
// LeaseVelocitySparkline — small monthly-bars chart pinned next to the
// active-leases hero so the 90-leases headline reads as a real curve
// (Jul/Aug move-in + Jan signing peak, May = off-season). Pure SVG so
// it server-renders + prints cleanly.
function LeaseVelocitySparkline({
  data,
}: {
  data: Array<{ month: string; count: number }>;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 260;
  const h = 56;
  const barW = w / data.length;
  return (
    <div className="space-y-1">
      <div className="text-[9.5px] tracking-widest uppercase font-bold text-muted-foreground">
        12-month lease velocity
      </div>
      <svg
        viewBox={`0 0 ${w} ${h + 12}`}
        width="100%"
        height={h + 12}
        aria-hidden="true"
        className="overflow-visible"
      >
        {data.map((d, i) => {
          const barH = Math.max(2, (d.count / max) * h);
          const x = i * barW + 2;
          const y = h - barH;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={Math.max(2, barW - 4)}
                height={barH}
                rx={1.5}
                fill="#0f62fe"
                opacity={d.count > 0 ? 1 : 0.18}
              />
              {d.count > 0 ? (
                <text
                  x={x + (barW - 4) / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill="#0043ce"
                >
                  {d.count}
                </text>
              ) : null}
              <text
                x={x + (barW - 4) / 2}
                y={h + 9}
                textAnchor="middle"
                fontSize="7"
                fill="#8d8d8d"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function monthLabel(yyyymm: string): string {
  const [, m] = yyyymm.split("-");
  const names = ["", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return names[parseInt(m, 10)] ?? "";
}

export function LifecycleStrip({ stats }: { stats: ReportLifecycleStats }) {
  const deltaPct =
    stats.priorLeasesSignedInPeriod > 0
      ? Math.round(
          ((stats.leasesSignedInPeriod - stats.priorLeasesSignedInPeriod) /
            stats.priorLeasesSignedInPeriod) *
            100,
        )
      : null;
  // Norman feedback (May 22, second pass): "the lifecycle pipeline
  // looks pretty bland". Root cause was sparse: with applications +
  // approved both 0 (AppFolio hasn't synced the application table for
  // SG), the strip read as half-empty zero tiles. We now only render
  // tiles that have real data — bland zeros never make it on screen
  // and the active-leases hero gets meaningful breathing room.
  const showApplications = stats.applicationsInPeriod > 0;
  const showSigned180 = stats.leasesSignedLast180d > 0;
  const showSignedPeriod = stats.leasesSignedInPeriod > 0;

  // Compute renewal/retention proxy: most tenants renew, so even a
  // zero-signed window typically has dozens of active leases churning
  // through. Surface "avg lease months remaining" if we have endDate
  // data downstream — but for the first cut, just keep the columns
  // honest. Span heroes when there's nothing to show beside them.
  const sideTiles = [showSignedPeriod, showSigned180, showApplications].filter(
    Boolean,
  ).length;
  // Norman feedback (May 22): the right-hand side tiles read as
  // empty wells when they were narrow + only carried a single
  // value. The hero now claims the whole row when there are zero
  // or just one side tile (so the velocity sparkline gets real
  // breathing room and we never ship a half-empty grid). With
  // multiple side tiles the layout reverts to a balanced 2-column
  // split where the hero still gets at least half the width.
  const heroSpan =
    sideTiles === 0
      ? "lg:col-span-4"
      : sideTiles === 1
        ? "lg:col-span-3"
        : "lg:col-span-2";
  // Side tiles stack vertically inside their column when we've got
  // two of them — much denser than parking them in narrow boxes
  // alongside the hero. Operations tab swaps to inline tiles only
  // when there are 3+ side metrics (rare — needs Application sync).
  const sideStacked = sideTiles === 2;
  return (
    <Section
      className="ls-report-section"
      eyebrow="AppFolio · live lease sync"
      title="Lifecycle pipeline"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">
        {/* Headline gradient tile — always rendered. Combines the
            closed-loop floor (active leases) with the 12-month
            velocity sparkline so ownership can immediately see WHEN
            those leases were signed (Jul/Aug move-in + Jan peak for
            student housing). Norman bug May 22: the 90 number read
            as suspicious next to the "1 signed in 28d" tile because
            the visual context was missing. */}
        <div
          className={`rounded-[2px] border border-primary/20 px-4 sm:px-5 py-4 ${heroSpan}`}
          style={{ backgroundColor: "#edf5ff" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                Active leases · right now
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <div
                  className="text-[40px] sm:text-[52px] font-bold tabular-nums leading-none"
                  style={{ color: "#0f62fe" }}
                >
                  {stats.activeLeases.toLocaleString()}
                </div>
                <span className="text-[12px] font-semibold text-primary uppercase tracking-wider">
                  leases on the books
                </span>
              </div>
              <div className="mt-2 text-[11.5px] text-muted-foreground leading-relaxed max-w-md">
                Closed-loop floor straight from the AppFolio lease sync —
                the retained-revenue number ownership cares about most.
                Updates automatically with every AppFolio webhook.
              </div>
            </div>
            {stats.monthlySignedLast12 &&
            stats.monthlySignedLast12.length > 0 ? (
              <div className="w-full sm:w-auto sm:min-w-[280px]">
                <LeaseVelocitySparkline data={stats.monthlySignedLast12} />
              </div>
            ) : null}
          </div>
        </div>
        {/* Side tiles. When there are exactly 2 (SG case: Signed
            period + Signed 180d) we stack them vertically inside a
            single 2-col-spanning slot — short tiles look much less
            empty stacked than spread across two narrow boxes. With
            3+ they go inline. */}
        {sideStacked ? (
          // Norman May 22 mobile bug: was grid-cols-1 which stacked
          // the two tiles vertically as full-width rows. They should
          // sit side-by-side at every breakpoint so the strip reads
          // as a single horizontal row (1x3) on phone instead of a
          // 3-row tall column.
          <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-2 self-stretch">
            {showSignedPeriod ? (
              <SideLifecycleTile
                label="Signed · period"
                value={stats.leasesSignedInPeriod}
                hint="Lease.startDate in window"
                delta={deltaPct}
              />
            ) : null}
            {showSigned180 ? (
              <SideLifecycleTile
                label="Signed · last 180d"
                value={stats.leasesSignedLast180d}
                hint="Seasonal rolling 6-month"
              />
            ) : null}
            {showApplications ? (
              <SideLifecycleTile
                label="Applications · period"
                value={stats.applicationsInPeriod}
                hint={`${stats.applicationsApprovedInPeriod} approved`}
              />
            ) : null}
          </div>
        ) : (
          <>
            {showSignedPeriod ? (
              <SideLifecycleTile
                label="Signed · period"
                value={stats.leasesSignedInPeriod}
                hint="Lease.startDate in window"
                delta={deltaPct}
              />
            ) : null}
            {showSigned180 ? (
              <SideLifecycleTile
                label="Signed · last 180d"
                value={stats.leasesSignedLast180d}
                hint="Seasonal rolling 6-month"
              />
            ) : null}
            {showApplications ? (
              <SideLifecycleTile
                label="Applications · period"
                value={stats.applicationsInPeriod}
                hint={`${stats.applicationsApprovedInPeriod} approved`}
              />
            ) : null}
          </>
        )}
      </div>
    </Section>
  );
}

function SideLifecycleTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: number;
  hint: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-[2px] border border-border bg-card px-3.5 py-3 h-full">
      <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-[24px] font-bold tabular-nums text-foreground leading-none">
          {value.toLocaleString()}
        </div>
        {delta != null ? <DeltaPill value={delta} currentValue={value} /> : null}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FunnelStrip — replaces the old FunnelList bar chart Norman called out.
// Renders each non-empty stage as a flat MiniStat tile in a horizontal
// row with an inline conversion-rate hint between adjacent stages, so
// the reader sees "New 3 → Tour scheduled 0 (0%) → Toured 0 (—)" as a
// dense data strip instead of a row of empty bars.
// ---------------------------------------------------------------------------
export function FunnelStrip({ stages }: { stages: ReportSnapshot["funnel"] }) {
  if (stages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No pipeline activity in this window yet.
      </p>
    );
  }
  return (
    <ol
      className="grid gap-1.5"
      // Norman May 22 mobile bug: at 390px viewport with 7 stages,
      // each cell is ~50px wide and the labels truncate to "N...",
      // "T S...", etc. auto-fit wraps to 2 rows on mobile (4+3) so
      // each cell gets ~90px minimum and labels read cleanly.
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(85px, 1fr))`,
      }}
    >
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const dropPct =
          prev && prev.count > 0
            ? Math.round((s.count / prev.count) * 100)
            : null;
        // Norman May 22: zeros made the strip look bland. Non-zero
        // tiles now read as filled brand cards; zero tiles fade to
        // a tighter outline so the eye lands on the real data
        // (NEW 3, SIGNED 1) instead of a row of identical white
        // cells.
        const isZero = s.count === 0;
        return (
          <li
            key={s.stage}
            className={`rounded-[2px] border px-3 py-2.5 relative ${
              isZero
                ? "border-dashed border-border bg-transparent"
                : "border-primary/30 bg-primary/[0.04]"
            }`}
          >
            <p className="text-[9.5px] tracking-widest uppercase font-bold text-muted-foreground truncate">
              {s.stage}
            </p>
            <p
              className={`mt-0.5 text-[20px] font-bold tabular-nums leading-none ${
                isZero ? "text-muted-foreground/60" : "text-foreground"
              }`}
            >
              {s.count.toLocaleString()}
            </p>
            {dropPct != null ? (
              <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                {dropPct}% from prev
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
