import "server-only";
import { buildBaseHtml, BRAND_NAME } from "./shared";
import { getSiteUrl } from "@/lib/brand";
import type { ReportSnapshot } from "@/lib/reports/generate";

// ---------------------------------------------------------------------------
// Weekly / Monthly client report email.
//
// Renders the frozen ClientReport snapshot into an email-safe HTML view plus
// a matching plain-text fallback. The email never exposes the operator's
// internal platform UI; it mirrors the public /r/[token] shareable view so
// that opening the email and opening the link feel identical.
//
// Design stays inside the warm parchment / terracotta palette. Email-safe
// rules: table layouts only, inline styles, no custom fonts, no background
// images, pixel widths, single accent color.
// ---------------------------------------------------------------------------

export interface ReportEmailInput {
  orgName: string;
  orgLogoUrl?: string | null;
  headline?: string | null;
  notes?: string | null;
  snapshot: ReportSnapshot;
  shareUrl: string; // absolute URL to /r/[token]
  recipientName?: string | null;
  senderName?: string | null;
}

const ACCENT = "#2563EB";
const PARCHMENT = "#f3f4f6";
const IVORY = "#ffffff";
const BORDER = "#e5e7eb";
const NEAR_BLACK = "#111111";
const OLIVE = "#94A3B8";
const STONE = "#9ca3af";

const KIND_LABELS = {
  weekly: "Weekly report",
  monthly: "Monthly report",
  custom: "Performance report",
} as const;

export function buildReportEmail(input: ReportEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { snapshot, orgName, shareUrl, recipientName, headline, notes } = input;
  const kindLabel = KIND_LABELS[snapshot.kind];
  const period = formatPeriod(snapshot.periodStart, snapshot.periodEnd);
  // senderName is intentionally NOT used in the body. Per the
  // 2026-05 product call, the email signs off as the LeaseStack
  // brand only — no agency-team personalization, no "Happy to jump
  // on a call" boilerplate. Clients should read the data and
  // self-serve the full report.
  void input.senderName;

  const subject = headline
    ? `${kindLabel}. ${headline}`
    : `${orgName} ${kindLabel.toLowerCase()} — ${period}`;

  const greeting = recipientName ? `Hi ${recipientName},` : `Hi,`;

  const kpiRow = renderKpiRow(snapshot);
  const funnelBlock = renderFunnel(snapshot);
  const insightsBlock = renderInsights(snapshot);
  const adBlock = renderAds(snapshot);
  const attributionBlock = renderAttribution(snapshot);
  const seoBlock = renderSeo(snapshot);
  const reputationBlock = renderReputation(snapshot);
  const sourcesBlock = renderDataSourcesEmail(snapshot);

  const bodyHtml = `
    <p style="margin:0 0 16px;color:${NEAR_BLACK};font-size:14px;line-height:1.55;">${greeting}</p>

    <p style="margin:0 0 16px;color:${OLIVE};font-size:14px;line-height:1.6;">
      Here is the ${kindLabel.toLowerCase()} for <strong style="color:${NEAR_BLACK};">${escapeHtml(orgName)}</strong> covering ${period}.
      ${headline ? `The headline: <strong style="color:${NEAR_BLACK};">${escapeHtml(headline)}</strong>.` : ""}
    </p>

    ${
      notes
        ? `<div style="margin:0 0 20px;padding:14px 18px;background-color:${PARCHMENT};border-left:3px solid ${ACCENT};">
             <p style="margin:0;color:${NEAR_BLACK};font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(notes)}</p>
           </div>`
        : ""
    }

    <h2 style="margin:28px 0 12px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Key numbers</h2>
    ${kpiRow}

    ${funnelBlock}
    ${insightsBlock}
    ${adBlock}
    ${attributionBlock}
    ${seoBlock}
    ${reputationBlock}
    ${sourcesBlock}

    <p style="margin:28px 0 8px;color:${OLIVE};font-size:13px;line-height:1.6;">
      Need the full breakdown with trend charts and property comparisons?
    </p>
    <p style="margin:0;">
      <a href="${shareUrl}" style="display:inline-block;color:${ACCENT};font-size:13px;font-weight:600;text-decoration:none;border-bottom:2px solid ${ACCENT};padding-bottom:1px;">Open the full report →</a>
    </p>

    <p style="margin:32px 0 0;color:${STONE};font-size:11px;line-height:1.6;">
      ${BRAND_NAME}
    </p>
  `;

  const html = buildBaseHtml({
    headline: `${kindLabel} — ${period}`,
    bodyHtml,
    theme: {
      outerBg: PARCHMENT,
      innerBg: IVORY,
      headerBg: ACCENT,
      headerText: "#ffffff",
      footerBg: "#f9fafb",
      footerText: NEAR_BLACK,
      footerSubText: STONE,
      headlineColor: NEAR_BLACK,
      border: BORDER,
    },
  });

  const text = buildPlainText(input, period, kindLabel);

  return { subject, html, text };
}

function renderKpiRow(s: ReportSnapshot): string {
  const ds = s.dataSources;
  const adsConnected = ds
    ? ds.googleAds.connected || ds.metaAds.connected
    : true;
  const ga4Connected = ds ? ds.ga4.connected : true;
  const appfolioConnected = ds ? ds.appfolio.connected : true;
  // Match the report-view gating exactly so the email and the share-link
  // page show the same KPI tiles for any given snapshot.
  const toursTracked = appfolioConnected || s.kpis.tours > 0;
  const applicationsTracked = appfolioConnected || s.kpis.applications > 0;
  const showCostPerLead = adsConnected && s.kpis.adSpendUsd > 0;

  const allCells = [
    {
      label: "Leads",
      value: s.kpis.leads.toLocaleString(),
      deltaPct: s.kpiDeltas.leadsPct,
      good: "up" as const,
      show: true,
    },
    {
      label: "Tours",
      value: s.kpis.tours.toLocaleString(),
      deltaPct: s.kpiDeltas.toursPct,
      good: "up" as const,
      show: toursTracked,
    },
    {
      label: "Applications",
      value: s.kpis.applications.toLocaleString(),
      deltaPct: s.kpiDeltas.applicationsPct,
      good: "up" as const,
      show: applicationsTracked,
    },
    {
      label: "Ad spend",
      value: `$${s.kpis.adSpendUsd.toLocaleString()}`,
      deltaPct: s.kpiDeltas.adSpendUsdPct,
      good: "down" as const,
      show: adsConnected && s.kpis.adSpendUsd > 0,
    },
    {
      label: "Cost per lead",
      value: s.kpis.costPerLead != null ? `$${s.kpis.costPerLead.toFixed(2)}` : "—",
      deltaPct: s.kpiDeltas.costPerLeadPct,
      good: "down" as const,
      show: showCostPerLead,
    },
    {
      label: "Organic sessions",
      value: s.kpis.organicSessions.toLocaleString(),
      deltaPct: s.kpiDeltas.organicSessionsPct,
      good: "up" as const,
      show: ga4Connected && s.kpis.organicSessions > 0,
    },
  ];

  // Filter to visible cells, then pad with empty cells to keep the
  // 3-column grid layout stable (email-safe — table cells don't
  // collapse cleanly when removed mid-row).
  const cells = allCells.filter((c) => c.show);
  type Cell = (typeof allCells)[number];

  const cellHtml = (c: Cell) => {
    const deltaHtml = deltaPill(c.deltaPct, c.good);
    return `
      <td style="width:33.33%;padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:top;">
        <div style="color:${STONE};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${c.label}</div>
        <div style="margin-top:4px;color:${NEAR_BLACK};font-size:22px;font-weight:700;font-feature-settings:'tnum';">${c.value}</div>
        ${deltaHtml ? `<div style="margin-top:2px;">${deltaHtml}</div>` : ""}
      </td>
    `;
  };
  const emptyCell = `<td style="width:33.33%;padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};"></td>`;

  function paddedRow(row: Cell[]): string {
    const html = row.map(cellHtml).join("");
    const padding = "".padEnd(Math.max(0, 3 - row.length), "x")
      .split("")
      .map(() => emptyCell)
      .join("");
    return html + padding;
  }

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(paddedRow(cells.slice(i, i + 3)));
  }
  if (rows.length === 0) rows.push(paddedRow([]));

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows.map((r) => `<tr>${r}</tr>`).join("")}
    </table>
  `;
}

function deltaPill(pct: number | null, good: "up" | "down"): string {
  if (pct == null) return `<span style="color:${STONE};font-size:10px;font-weight:600;">new</span>`;
  if (pct === 0) return `<span style="color:${STONE};font-size:10px;font-weight:600;">no change</span>`;
  const isGood = good === "up" ? pct > 0 : pct < 0;
  const color = isGood ? "#047857" : "#b91c1c";
  const bg = isGood ? "#ecfdf5" : "#fef2f2";
  const arrow = pct > 0 ? "▲" : "▼";
  return `<span style="display:inline-block;padding:1px 6px;background-color:${bg};color:${color};font-size:10px;font-weight:700;font-feature-settings:'tnum';">${arrow} ${Math.abs(pct)}%</span>`;
}

function renderFunnel(s: ReportSnapshot): string {
  if (s.funnel.length === 0) return "";
  const max = Math.max(...s.funnel.map((f) => f.count), 1);
  const rows = s.funnel
    .map((stage) => {
      const width = Math.round((stage.count / max) * 100);
      return `
        <tr>
          <td style="padding:6px 10px 6px 0;color:${NEAR_BLACK};font-size:12px;width:140px;">${escapeHtml(stage.stage)}</td>
          <td style="padding:6px 0;">
            <div style="height:10px;background-color:${PARCHMENT};position:relative;">
              <div style="height:10px;width:${width}%;background-color:${ACCENT};"></div>
            </div>
          </td>
          <td style="padding:6px 0 6px 10px;color:${NEAR_BLACK};font-size:12px;font-weight:700;text-align:right;width:60px;font-feature-settings:'tnum';">${stage.count}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <h2 style="margin:28px 0 10px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Funnel</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
  `;
}

function renderInsights(s: ReportSnapshot): string {
  if (!s.insights || s.insights.length === 0) return "";
  const top = s.insights.slice(0, 4);
  const rows = top
    .map((i) => {
      const tone =
        i.severity === "critical"
          ? { bg: "#fef2f2", fg: "#991b1b", label: "Critical" }
          : i.severity === "warning"
            ? { bg: "#fffbeb", fg: "#92400e", label: "Warning" }
            : { bg: "#eff6ff", fg: "#1e40af", label: "Info" };
      return `
        <tr>
          <td style="padding:12px 14px;border:1px solid ${BORDER};background-color:${IVORY};">
            <div>
              <span style="display:inline-block;padding:1px 6px;background-color:${tone.bg};color:${tone.fg};font-size:9px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">${tone.label}</span>
              <span style="margin-left:6px;color:${STONE};font-size:9px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">${escapeHtml(i.kind.replace(/_/g, " "))}</span>
            </div>
            <div style="margin-top:6px;color:${NEAR_BLACK};font-size:13px;font-weight:700;">${escapeHtml(i.title)}</div>
            <div style="margin-top:4px;color:${OLIVE};font-size:12px;line-height:1.5;">${escapeHtml(i.body)}</div>
          </td>
        </tr>
      `;
    })
    .join("");
  return `
    <h2 style="margin:28px 0 10px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">What we flagged this period</h2>
    <table width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;border-spacing:0 6px;">${rows}</table>
  `;
}

function renderAds(s: ReportSnapshot): string {
  if (!s.adPerformance || s.adPerformance.length === 0) return "";
  // Don't show paid channels block if no ad source is currently
  // connected. Stale AdMetricDaily rows from a disconnected
  // integration would otherwise leak into the email.
  const ds = s.dataSources;
  if (ds && !(ds.googleAds.connected || ds.metaAds.connected)) return "";
  const rows = s.adPerformance
    .map(
      (a) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;">${escapeHtml(a.platform)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">$${a.spendUsd.toLocaleString()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${a.leads}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${a.cpl != null ? "$" + a.cpl.toFixed(2) : "—"}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <h2 style="margin:28px 0 10px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Paid channels</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BORDER};">
      <thead>
        <tr style="background-color:${PARCHMENT};">
          <th style="padding:8px 12px;text-align:left;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Platform</th>
          <th style="padding:8px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Spend</th>
          <th style="padding:8px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Leads</th>
          <th style="padding:8px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">CPL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAttribution(s: ReportSnapshot): string {
  if (!s.attributionBySource || s.attributionBySource.length === 0) return "";
  const hasSigned = s.attributionBySource.some(r => r.signed > 0);
  const rows = s.attributionBySource
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;">${escapeHtml(r.source)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${r.leads}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${r.signed}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <h2 style="margin:28px 0 10px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Where leases came from</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BORDER};">
      <thead>
        <tr style="background-color:${PARCHMENT};">
          <th style="padding:8px 12px;text-align:left;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Source</th>
          <th style="padding:8px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Leads</th>
          <th style="padding:8px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Signed</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${!hasSigned ? `<p style="margin:6px 0 0;color:${STONE};font-size:11px;">No signed leases recorded this period.</p>` : ""}
  `;
}

function renderSeo(s: ReportSnapshot): string {
  if (!s.topQueries || s.topQueries.length === 0) return "";
  // GSC drives top queries; skip the section if it isn't connected.
  const ds = s.dataSources;
  if (ds && !ds.gsc.connected) return "";
  const rows = s.topQueries
    .slice(0, 5)
    .map(
      (q) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;">${escapeHtml(q.query)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${q.clicks}</td>
          <td style="padding:6px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${q.impressions}</td>
          <td style="padding:6px 12px;border-bottom:1px solid ${BORDER};color:${NEAR_BLACK};font-size:12px;text-align:right;font-feature-settings:'tnum';">${q.position != null ? q.position.toFixed(1) : "—"}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <h2 style="margin:28px 0 10px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Top search queries</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BORDER};">
      <thead>
        <tr style="background-color:${PARCHMENT};">
          <th style="padding:6px 12px;text-align:left;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Query</th>
          <th style="padding:6px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Clicks</th>
          <th style="padding:6px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Impr.</th>
          <th style="padding:6px 12px;text-align:right;color:${STONE};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Pos.</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Reputation block — full mention bodies in email, not just KPIs.
// Renders a compact rating + counts row, then up to 3 highlights and
// 3 concerns with each mention's source / rating / sentiment / author
// / date / full body / source link. Falls back to chronological recent
// when the snapshot doesn't have curated buckets (older snapshots).
function renderReputation(s: ReportSnapshot): string {
  const stats = s.reputationStats;
  if (!stats) return "";

  const ratingLine =
    stats.overallRating != null
      ? `<span style="color:${NEAR_BLACK};font-size:24px;font-weight:700;font-feature-settings:'tnum';">${stats.overallRating.toFixed(1)}</span><span style="color:#f59e0b;font-size:18px;margin-left:4px;">★</span>`
      : "—";

  const summaryRow = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;">
      <tr>
        <td style="padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:top;width:33.33%;">
          <div style="color:${STONE};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Overall</div>
          <div style="margin-top:4px;">${ratingLine}</div>
          <div style="color:${OLIVE};font-size:11px;margin-top:2px;">${stats.totalReviews.toLocaleString()} lifetime</div>
        </td>
        <td style="padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:top;width:33.33%;">
          <div style="color:${STONE};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">New this period</div>
          <div style="margin-top:4px;color:${NEAR_BLACK};font-size:22px;font-weight:700;font-feature-settings:'tnum';">${stats.newInPeriod.toLocaleString()}</div>
          <div style="color:${OLIVE};font-size:11px;margin-top:2px;">${stats.positiveCount} positive · ${stats.negativeCount} negative</div>
        </td>
        <td style="padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:top;width:33.33%;">
          <div style="color:${STONE};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Response rate</div>
          <div style="margin-top:4px;color:${NEAR_BLACK};font-size:22px;font-weight:700;font-feature-settings:'tnum';">${stats.responseRatePct != null ? `${stats.responseRatePct}%` : "—"}</div>
          <div style="color:${OLIVE};font-size:11px;margin-top:2px;">Reviewed mentions</div>
        </td>
      </tr>
    </table>
  `;

  const highlights = (stats.highlights ?? []).slice(0, 3);
  const concerns = (stats.concerns ?? []).slice(0, 3);
  const recent = (stats.recent ?? stats.topMentions ?? []).slice(0, 4);

  const highlightsHtml =
    highlights.length > 0
      ? `<h3 style="margin:18px 0 8px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">What residents are loving</h3>${highlights.map((m) => mentionCardEmail(m, "highlight")).join("")}`
      : "";

  const concernsHtml =
    concerns.length > 0
      ? `<h3 style="margin:18px 0 8px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">What needs attention</h3>${concerns.map((m) => mentionCardEmail(m, "concern")).join("")}`
      : "";

  const recentHtml =
    recent.length > 0
      ? `<h3 style="margin:18px 0 8px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Recent mentions</h3>${recent.map((m) => mentionCardEmail(m, "neutral")).join("")}`
      : "";

  return `
    <h2 style="margin:28px 0 12px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Reputation pulse</h2>
    ${summaryRow}
    ${highlightsHtml}
    ${concernsHtml}
    ${highlightsHtml || concernsHtml ? "" : recentHtml}
  `;
}

function mentionCardEmail(
  m: NonNullable<ReportSnapshot["reputationStats"]>["recent"][number],
  variant: "highlight" | "concern" | "neutral",
): string {
  const bg =
    variant === "concern"
      ? "#fef3c7"
      : variant === "highlight"
        ? "#ecfdf5"
        : IVORY;
  const borderColor =
    variant === "concern"
      ? "#fcd34d"
      : variant === "highlight"
        ? "#a7f3d0"
        : BORDER;

  const stars =
    m.rating != null
      ? `<span style="color:#f59e0b;font-size:13px;letter-spacing:0.5px;">${"★".repeat(Math.round(m.rating))}<span style="color:#fcd34d;">${"★".repeat(Math.max(0, 5 - Math.round(m.rating)))}</span></span> <span style="color:${NEAR_BLACK};font-size:11px;font-weight:600;">${m.rating.toFixed(1)}</span>`
      : "";

  const sentimentChip = m.sentiment
    ? `<span style="display:inline-block;padding:2px 6px;border:1px solid ${borderColor};border-radius:3px;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${variant === "concern" ? "#92400e" : variant === "highlight" ? "#065f46" : OLIVE};margin-left:6px;">${m.sentiment.toLowerCase()}</span>`
    : "";

  const author = m.authorName
    ? `<div style="color:${OLIVE};font-size:11px;margin-top:2px;">${escapeHtml(m.authorName)}</div>`
    : "";

  const date = m.publishedAt
    ? `<div style="color:${STONE};font-size:10px;font-feature-settings:'tnum';">${formatShortDate(m.publishedAt)}</div>`
    : "";

  const title = m.title
    ? `<h4 style="margin:6px 0 6px;color:${NEAR_BLACK};font-size:13px;font-weight:600;line-height:1.4;">${escapeHtml(m.title)}</h4>`
    : "";

  // Cap email body to ~600 chars per mention. Most reviews fit; long
  // Reddit posts get a "..." with the source link. Email clients are
  // unforgiving about giant blockquotes.
  const fullBody = m.excerpt ?? "";
  const truncated = fullBody.length > 600 ? `${fullBody.slice(0, 600).trim()}…` : fullBody;
  const body = truncated
    ? `<p style="margin:6px 0 0;color:${NEAR_BLACK};font-size:12px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(truncated)}</p>`
    : "";

  const link = m.sourceUrl
    ? `<p style="margin:8px 0 0;"><a href="${m.sourceUrl}" style="color:${ACCENT};font-size:11px;font-weight:600;text-decoration:none;">Open on ${escapeHtml(m.source.toLowerCase())} →</a></p>`
    : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <td style="padding:12px 14px;border:1px solid ${borderColor};background-color:${bg};border-radius:8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <div>
                  <span style="color:${NEAR_BLACK};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(m.source)}</span>
                  ${stars ? `&nbsp;${stars}` : ""}
                  ${sentimentChip}
                </div>
                ${title}
              </td>
              <td style="vertical-align:top;text-align:right;white-space:nowrap;">
                ${date}
                ${author}
              </td>
            </tr>
          </table>
          ${body}
          ${link}
        </td>
      </tr>
    </table>
  `;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Data source transparency block — mirrors DataSourcesFooter on the
// share-link view. Builds trust by making it explicit which
// integrations are flowing data into the report and which are still
// pending. No fake "connected (no data)" claims; if it's not
// connected, the row says so.
function renderDataSourcesEmail(s: ReportSnapshot): string {
  const ds = s.dataSources;
  if (!ds) return "";

  const rows: Array<{ label: string; connected: boolean }> = [
    { label: "Google Ads", connected: ds.googleAds.connected },
    { label: "Meta Ads", connected: ds.metaAds.connected },
    { label: "Google Analytics 4", connected: ds.ga4.connected },
    { label: "Google Search Console", connected: ds.gsc.connected },
    { label: "Cursive Pixel", connected: ds.pixel.connected },
    { label: "AppFolio", connected: ds.appfolio.connected },
    { label: "Chatbot", connected: ds.chatbot.connected },
  ];

  const cellHtml = (r: (typeof rows)[number]) => `
    <td style="width:33.33%;padding:8px 10px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:middle;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:${NEAR_BLACK};font-size:11px;font-weight:600;">${escapeHtml(r.label)}</span>
        <span style="color:${r.connected ? "#047857" : STONE};font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;">
          ${r.connected ? "● Connected" : "○ Not connected"}
        </span>
      </div>
    </td>
  `;
  const emptyCell = `<td style="width:33.33%;border:1px solid ${BORDER};background-color:${IVORY};"></td>`;

  function paddedRow(group: typeof rows): string {
    const html = group.map(cellHtml).join("");
    const padding = "".padEnd(Math.max(0, 3 - group.length), "x")
      .split("")
      .map(() => emptyCell)
      .join("");
    return `<tr>${html}${padding}</tr>`;
  }

  const trs: string[] = [];
  for (let i = 0; i < rows.length; i += 3) {
    trs.push(paddedRow(rows.slice(i, i + 3)));
  }

  return `
    <h2 style="margin:28px 0 6px;color:${NEAR_BLACK};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Data sources</h2>
    <p style="margin:0 0 10px;color:${OLIVE};font-size:12px;line-height:1.5;">
      We only show metrics for sources that are actively flowing data.
      Sections you don&apos;t see in this report belong to integrations
      that aren&apos;t connected yet.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${trs.join("")}</table>
  `;
}

function buildPlainText(input: ReportEmailInput, period: string, kindLabel: string): string {
  const { snapshot, orgName, shareUrl, headline, notes } = input;
  // senderName intentionally unused — plain-text mirrors the HTML body
  // and signs off as the LeaseStack brand only.
  void input.senderName;
  const lines: string[] = [];
  lines.push(`${kindLabel} — ${orgName}`);
  lines.push(period);
  lines.push("");
  if (headline) {
    lines.push(`Headline: ${headline}`);
    lines.push("");
  }
  if (notes) {
    lines.push(notes);
    lines.push("");
  }
  lines.push("Key numbers");
  lines.push(`  Leads: ${snapshot.kpis.leads}`);
  lines.push(`  Tours: ${snapshot.kpis.tours}`);
  lines.push(`  Applications: ${snapshot.kpis.applications}`);
  lines.push(`  Ad spend: $${snapshot.kpis.adSpendUsd.toLocaleString()}`);
  if (snapshot.kpis.costPerLead != null) {
    lines.push(`  Cost per lead: $${snapshot.kpis.costPerLead.toFixed(2)}`);
  }
  lines.push(`  Organic sessions: ${snapshot.kpis.organicSessions.toLocaleString()}`);
  if (snapshot.attributionBySource && snapshot.attributionBySource.length > 0) {
    lines.push("");
    lines.push("Where leases came from");
    for (const r of snapshot.attributionBySource) {
      lines.push(`  ${r.source}: ${r.leads} leads, ${r.signed} signed`);
    }
  }
  if (snapshot.reputationStats) {
    const rep = snapshot.reputationStats;
    lines.push("");
    lines.push("Reputation pulse");
    if (rep.overallRating != null) {
      lines.push(`  ${rep.overallRating.toFixed(1)}★ across ${rep.totalReviews} reviews`);
    } else {
      lines.push(`  ${rep.totalReviews} mentions tracked`);
    }
    lines.push(`  ${rep.newInPeriod} new this period · ${rep.positiveCount} positive · ${rep.negativeCount} negative`);
    const showcase =
      (rep.highlights ?? []).slice(0, 2).concat((rep.concerns ?? []).slice(0, 2));
    if (showcase.length === 0) {
      showcase.push(...((rep.recent ?? rep.topMentions ?? []).slice(0, 3)));
    }
    if (showcase.length > 0) {
      lines.push("");
      for (const m of showcase) {
        const star = m.rating != null ? ` ${m.rating.toFixed(1)}★` : "";
        const author = m.authorName ? ` — ${m.authorName}` : "";
        lines.push(`  [${m.source}${star}]${author}`);
        const body = m.excerpt
          ? m.excerpt.replace(/\s+/g, " ").trim()
          : "";
        if (body) {
          const t = body.length > 240 ? `${body.slice(0, 240)}…` : body;
          lines.push(`  "${t}"`);
        }
        if (m.sourceUrl) lines.push(`  ${m.sourceUrl}`);
        lines.push("");
      }
    }
  }
  lines.push("");
  lines.push(`Full report: ${shareUrl}`);
  lines.push("");
  lines.push(BRAND_NAME);
  return lines.join("\n");
}

function formatPeriod(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(s)} — ${fmt(e)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Compose an absolute share URL for the public /r/[token] viewer.
 */
export function shareReportUrl(token: string): string {
  return `${getSiteUrl()}/r/${token}`;
}
