import "server-only";
import type { InsightSeverity } from "@/lib/insights/types";

// ---------------------------------------------------------------------------
// Daily insight digest — email template.
//
// Renders the operator's open insights as a clean Gmail-compatible HTML
// email. Single brand-blue accent, monochrome body, no patchwork colours.
// Severity is signalled with text labels + a simple coloured bar (not
// emoji or hue-rotated badges).
//
// We deliberately keep this email under 100 lines of HTML so it loads
// fast on mobile and renders cleanly in dark mode.
// ---------------------------------------------------------------------------

export type DigestInsightVM = {
  id: string;
  severity: InsightSeverity;
  category: string;
  title: string;
  body: string;
  suggestedAction?: string | null;
  href?: string | null;
  propertyName?: string | null;
};

export type DigestPayload = {
  orgName: string;
  insights: DigestInsightVM[];
  counts: { critical: number; warning: number; info: number; total: number };
  portalUrl: string; // base portal URL for "View all" link
};

const BRAND_BLUE = "#2563EB";
const INK = "#0A0A0A";
const MUTED = "#5C5E62";
const BORDER = "#E5E5E5";
const SOFT_BG = "#FAFAF7";
const TINT_BG = "#EFF6FF";

export function buildInsightDigestEmail(payload: DigestPayload): string {
  const headlineNumber = payload.counts.critical + payload.counts.warning;
  const headline =
    headlineNumber > 0
      ? `${headlineNumber} new insight${headlineNumber === 1 ? "" : "s"} need your attention`
      : `${payload.counts.info} new insight${payload.counts.info === 1 ? "" : "s"} from your data`;

  const insightsHtml = payload.insights
    .slice(0, 5)
    .map((i) => insightRow(i, payload.portalUrl))
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Daily insights · LeaseStack</title>
</head>
<body style="margin:0;padding:0;background-color:${SOFT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SOFT_BG};padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${BORDER};border-top:3px solid ${BRAND_BLUE};">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND_BLUE};">
                Daily insights
              </p>
              <h1 style="margin:8px 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;font-weight:600;color:${INK};">
                ${escapeHtml(headline)}
              </h1>
              <p style="margin:8px 0 0 0;font-size:13px;line-height:1.55;color:${MUTED};">
                ${escapeHtml(payload.orgName)} &middot; ${payload.counts.critical} critical &middot; ${payload.counts.warning} warning &middot; ${payload.counts.info} info
              </p>
            </td>
          </tr>
          ${insightsHtml}
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <a href="${escapeAttr(payload.portalUrl)}/portal/insights" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 18px;border-radius:6px;">
                View all insights →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;border-top:1px solid ${BORDER};">
              <p style="margin:18px 0 0 0;font-size:11px;line-height:1.5;color:${MUTED};">
                LeaseStack &middot; You&apos;re receiving this because you&apos;re an admin on ${escapeHtml(payload.orgName)}. Manage your notification preferences from <a href="${escapeAttr(payload.portalUrl)}/portal/notifications" style="color:${BRAND_BLUE};">the portal</a>.
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

export function insightDigestSubject(payload: DigestPayload): string {
  if (payload.counts.critical > 0) {
    return `${payload.counts.critical} critical insight${payload.counts.critical === 1 ? "" : "s"} for ${payload.orgName}`;
  }
  if (payload.counts.warning > 0) {
    return `${payload.counts.warning} warning${payload.counts.warning === 1 ? "" : "s"} for ${payload.orgName}`;
  }
  return `${payload.counts.info} new insight${payload.counts.info === 1 ? "" : "s"} for ${payload.orgName}`;
}

function insightRow(i: DigestInsightVM, portalUrl: string): string {
  const sevLabel =
    i.severity === "critical"
      ? "Critical"
      : i.severity === "warning"
        ? "Warning"
        : "Info";
  const sevColor =
    i.severity === "critical"
      ? "#DC2626"
      : i.severity === "warning"
        ? BRAND_BLUE
        : MUTED;
  const tint = i.severity === "critical" ? "rgba(220,38,38,0.04)" : TINT_BG;

  const categoryLabel = i.category.charAt(0).toUpperCase() + i.category.slice(1);
  const linkUrl = i.href
    ? i.href.startsWith("http")
      ? i.href
      : `${portalUrl}${i.href}`
    : `${portalUrl}/portal/insights`;

  return `
    <tr>
      <td style="padding:8px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tint};border:1px solid ${BORDER};border-left:3px solid ${sevColor};">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0 0 4px 0;font-size:10px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${sevColor};">
                ${sevLabel} &middot; ${escapeHtml(categoryLabel)}${i.propertyName ? ` &middot; ${escapeHtml(i.propertyName)}` : ""}
              </p>
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;line-height:1.35;color:${INK};">
                ${escapeHtml(i.title)}
              </p>
              <p style="margin:0;font-size:12.5px;line-height:1.55;color:${MUTED};">
                ${escapeHtml(i.body)}
              </p>
              ${
                i.suggestedAction
                  ? `<p style="margin:8px 0 0 0;font-size:12px;line-height:1.55;color:${INK};font-style:italic;">→ ${escapeHtml(i.suggestedAction)}</p>`
                  : ""
              }
              <p style="margin:10px 0 0 0;font-size:12px;">
                <a href="${escapeAttr(linkUrl)}" style="color:${BRAND_BLUE};font-weight:600;text-decoration:none;">
                  Open in LeaseStack →
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
