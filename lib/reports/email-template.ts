// ---------------------------------------------------------------------------
// Weekly digest email template.
//
// @react-email/components is not installed; this module renders a clean HTML
// string directly. Colors follow the design spec: primary blue #2563EB, text
// #111, muted #87867f, background white. No Tailwind classes, no emojis.
// ---------------------------------------------------------------------------

import type { WeeklyDigest } from "./weekly-digest";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDollars(cents: number): string {
  if (cents === 0) return "$0";
  const usd = cents / 100;
  if (usd >= 1000) {
    return `$${(usd / 1000).toFixed(1)}k`;
  }
  return `$${usd.toFixed(0)}`;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "—";
}

function deltaColor(delta: number): string {
  if (delta > 0) return "#047857";
  if (delta < 0) return "#B91C1C";
  return "#87867f";
}

function e(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Subject line
// ---------------------------------------------------------------------------

export function weeklyDigestSubject(digest: WeeklyDigest): string {
  return `Your weekly leasing report — ${digest.weekLabel}`;
}

// ---------------------------------------------------------------------------
// KPI block
// ---------------------------------------------------------------------------

type KpiItem = {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
};

function kpiCard(item: KpiItem): string {
  const deltaHtml = item.delta
    ? `<span style="display:block;margin-top:4px;font-size:12px;font-weight:600;color:${item.deltaColor ?? "#87867f"};">${e(item.delta)} vs last week</span>`
    : "";

  return `
    <td width="25%" style="padding:0 8px 0 0;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:4px;">
        <tr>
          <td style="padding:16px;">
            <span style="display:block;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#87867f;font-weight:600;">${e(item.label)}</span>
            <span style="display:block;margin-top:6px;font-size:28px;font-weight:700;color:#111111;font-variant-numeric:tabular-nums;">${e(item.value)}</span>
            ${deltaHtml}
          </td>
        </tr>
      </table>
    </td>
  `;
}

// ---------------------------------------------------------------------------
// Top properties table
// ---------------------------------------------------------------------------

function topPropertiesTable(
  props: WeeklyDigest["topProperties"]
): string {
  if (props.length === 0) return "";

  const rows = props
    .map(
      (p) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">${e(p.name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111111;font-weight:600;text-align:right;">${p.leads}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111111;font-weight:600;text-align:right;">${p.tours}</td>
    </tr>
  `
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E5E7EB;margin-top:24px;">
      <thead>
        <tr style="background-color:#F9FAFB;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;font-weight:700;">Property</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;font-weight:700;">Leads</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;font-weight:700;">Tours</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Insights badge
// ---------------------------------------------------------------------------

function insightsBadge(count: number): string {
  if (count === 0) return "";
  return `
    <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="background-color:#FEF3C7;border:1px solid #FCD34D;border-radius:4px;padding:10px 16px;">
          <span style="font-size:13px;font-weight:600;color:#92400E;">${count} open insight${count === 1 ? "" : "s"} waiting for your review</span>
        </td>
      </tr>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// buildWeeklyDigestEmail
// ---------------------------------------------------------------------------

export function buildWeeklyDigestEmail(
  digest: WeeklyDigest,
  portalUrl: string
): string {
  const { orgName, weekLabel, metrics, topProperties, openInsights } = digest;
  const {
    leadsThisWeek,
    leadsDelta,
    toursThisWeek,
    toursDelta,
    applicationsThisWeek,
    adSpendCents,
  } = metrics;

  const kpis: KpiItem[] = [
    {
      label: "Leads",
      value: String(leadsThisWeek),
      delta: formatDelta(leadsDelta),
      deltaColor: deltaColor(leadsDelta),
    },
    {
      label: "Tours",
      value: String(toursThisWeek),
      delta: formatDelta(toursDelta),
      deltaColor: deltaColor(toursDelta),
    },
    {
      label: "Applications",
      value: String(applicationsThisWeek),
    },
    {
      label: "Ad Spend",
      value: formatDollars(adSpendCents),
    },
  ];

  // Last KPI card shouldn't have right padding
  const kpiCards = kpis
    .map((k, i) => kpiCard({ ...k }))
    .join("")
    .replace(/padding:0 8px 0 0;[^"]*"[^>]*>$/, (m) =>
      m.replace("padding:0 8px 0 0;", "padding:0;")
    );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Weekly Leasing Report</title>
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E5E7EB;">

          <!-- Header -->
          <tr>
            <td style="background-color:#2563EB;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">LeaseStack</p>
              <p style="margin:8px 0 0;color:#BFDBFE;font-size:13px;">Weekly Leasing Report</p>
            </td>
          </tr>

          <!-- Org + week label -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111111;">${e(orgName)}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#87867f;">${e(weekLabel)}</p>
            </td>
          </tr>

          <!-- KPI row -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${kpiCards}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Insights badge -->
          <tr>
            <td style="padding:0 32px;">
              ${insightsBadge(openInsights)}
            </td>
          </tr>

          <!-- Top properties table -->
          ${
            topProperties.length > 0
              ? `<tr>
              <td style="padding:0 32px;">
                <p style="margin:24px 0 0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#87867f;">Top Properties</p>
                ${topPropertiesTable(topProperties)}
              </td>
            </tr>`
              : ""
          }

          <!-- Portal CTA -->
          <tr>
            <td style="padding:28px 32px 32px;">
              <p style="margin:0 0 16px;font-size:13px;color:#87867f;">Full lead history, visitor analytics, and campaign details are in your portal.</p>
              <a href="${e(portalUrl)}" style="display:inline-block;background-color:#2563EB;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:13px 28px;letter-spacing:0.04em;">
                Open Portal
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E5E7EB;background-color:#F9FAFB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Powered by <a href="https://leasestack.co" style="color:#87867f;text-decoration:none;">LeaseStack</a>
                &nbsp;&middot;&nbsp;
                <a href="${e(portalUrl)}/settings/notifications" style="color:#87867f;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
