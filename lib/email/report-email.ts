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
const OLIVE = "#6b7280";
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
  const { snapshot, orgName, shareUrl, recipientName, senderName, headline, notes } = input;
  const kindLabel = KIND_LABELS[snapshot.kind];
  const period = formatPeriod(snapshot.periodStart, snapshot.periodEnd);

  const subject = headline
    ? `${kindLabel}. ${headline}`
    : `${orgName} ${kindLabel.toLowerCase()} — ${period}`;

  const greeting = recipientName ? `Hi ${recipientName},` : `Hi,`;
  const senderLine = senderName ? `${senderName}` : `The ${BRAND_NAME} team`;

  const kpiRow = renderKpiRow(snapshot);
  const funnelBlock = renderFunnel(snapshot);
  const insightsBlock = renderInsights(snapshot);
  const adBlock = renderAds(snapshot);
  const seoBlock = renderSeo(snapshot);

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
    ${seoBlock}

    <p style="margin:28px 0 8px;color:${OLIVE};font-size:13px;line-height:1.6;">
      Full report with trend charts and property breakdowns:
    </p>
    <p style="margin:0;">
      <a href="${shareUrl}" style="display:inline-block;color:${ACCENT};font-size:13px;font-weight:600;text-decoration:none;border-bottom:2px solid ${ACCENT};padding-bottom:1px;">Open the full report</a>
    </p>

    <p style="margin:32px 0 0;color:${OLIVE};font-size:13px;line-height:1.6;">
      Happy to jump on a call if anything stands out.<br/>
      ${escapeHtml(senderLine)}
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
  const cells = [
    { label: "Leads", value: s.kpis.leads.toLocaleString(), deltaPct: s.kpiDeltas.leadsPct, good: "up" as const },
    { label: "Tours", value: s.kpis.tours.toLocaleString(), deltaPct: s.kpiDeltas.toursPct, good: "up" as const },
    {
      label: "Applications",
      value: s.kpis.applications.toLocaleString(),
      deltaPct: s.kpiDeltas.applicationsPct,
      good: "up" as const,
    },
    {
      label: "Ad spend",
      value: `$${s.kpis.adSpendUsd.toLocaleString()}`,
      deltaPct: s.kpiDeltas.adSpendUsdPct,
      good: "down" as const,
    },
    {
      label: "Cost per lead",
      value: s.kpis.costPerLead != null ? `$${s.kpis.costPerLead.toFixed(2)}` : "—",
      deltaPct: s.kpiDeltas.costPerLeadPct,
      good: "down" as const,
    },
    {
      label: "Organic sessions",
      value: s.kpis.organicSessions.toLocaleString(),
      deltaPct: s.kpiDeltas.organicSessionsPct,
      good: "up" as const,
    },
  ];

  const cellHtml = (c: (typeof cells)[number]) => {
    const deltaHtml = deltaPill(c.deltaPct, c.good);
    return `
      <td style="width:33.33%;padding:10px 12px;border:1px solid ${BORDER};background-color:${IVORY};vertical-align:top;">
        <div style="color:${STONE};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${c.label}</div>
        <div style="margin-top:4px;color:${NEAR_BLACK};font-size:22px;font-weight:700;font-feature-settings:'tnum';">${c.value}</div>
        ${deltaHtml ? `<div style="margin-top:2px;">${deltaHtml}</div>` : ""}
      </td>
    `;
  };

  const row1 = cells.slice(0, 3).map(cellHtml).join("");
  const row2 = cells.slice(3, 6).map(cellHtml).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>${row1}</tr>
      <tr>${row2}</tr>
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

function renderSeo(s: ReportSnapshot): string {
  if (!s.topQueries || s.topQueries.length === 0) return "";
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

function buildPlainText(input: ReportEmailInput, period: string, kindLabel: string): string {
  const { snapshot, orgName, shareUrl, headline, notes, senderName } = input;
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
  lines.push("");
  lines.push(`Full report: ${shareUrl}`);
  lines.push("");
  lines.push(senderName ?? `The ${BRAND_NAME} team`);
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
