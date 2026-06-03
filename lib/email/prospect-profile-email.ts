import "server-only";
import { buildBaseHtml } from "./shared";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";

// ---------------------------------------------------------------------------
// buildProspectProfileEmail — the rich digest the agency operator gets
// after a chatbot conversation goes idle (or is manually handed off).
// Includes every field the prospect shared so the operator can prep for
// the follow-up without scrolling the entire transcript.
//
// Trigger: /api/cron/chatbot-profile-digest (every 5 min) or the
// /api/tenant/conversations/[id]/handoff route (immediately).
// ---------------------------------------------------------------------------

type ProspectProfileEmailInput = {
  orgName: string;
  propertyName: string | null;
  portalUrl: string;
  profile: ProspectProfile;
  /** Total message count in the conversation — surfaced so the operator
   *  knows whether the prospect chatted briefly or had a deep session. */
  messageCount: number;
  /** ISO of the conversation's lastMessageAt — "Last activity 7 min ago". */
  lastMessageAtIso: string;
  /** Optional: the prospect's chat session source (page URL where the
   *  widget was loaded). Gives the operator context. */
  pageUrl: string | null;
};

type ProspectProfileEmailOutput = { html: string; text: string; subject: string };

const SENTIMENT_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  hot: { label: "HOT — ready to lease", bg: "#FEE2E2", fg: "#B91C1C" },
  warm: { label: "WARM — actively shopping", bg: "#FED7AA", fg: "#9A3412" },
  lukewarm: { label: "LUKEWARM — exploring", bg: "#FEF3C7", fg: "#92400E" },
  cold: { label: "COLD — early browsing", bg: "#DBEAFE", fg: "#1E40AF" },
  unclear: { label: "Unclear", bg: "#F3F4F6", fg: "#374151" },
};

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | null | undefined): string {
  if (!value || value.trim().length === 0) return "";
  return `
    <tr>
      <td style="padding:9px 0;color:#6b7280;font-size:12.5px;vertical-align:top;white-space:nowrap;width:140px;font-weight:500;">${escape(label)}</td>
      <td style="padding:9px 0;color:#111827;font-size:14px;font-weight:500;line-height:1.5;">${escape(value)}</td>
    </tr>`;
}

function listRow(label: string, values: string[] | null | undefined): string {
  if (!values || values.length === 0) return "";
  return row(label, values.map((v) => `• ${v}`).join("  "));
}

function fmtRel(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  } catch {
    return "recently";
  }
}

export function buildProspectProfileEmail(
  input: ProspectProfileEmailInput,
): ProspectProfileEmailOutput {
  const { profile, orgName, propertyName, portalUrl } = input;
  // Profile fields now use empty strings as the "not provided" sentinel
  // (was nullable strings — Anthropic tool-calling capped at 16 unions
  // and we had 18). All truthy checks below handle "" identically to
  // null. See lib/chatbot/extract-prospect-profile.ts for the rationale.
  const displayName =
    profile.fullName || profile.email || "Anonymous prospect";
  const propertyLabel = propertyName ?? orgName;
  const sentimentTone =
    SENTIMENT_TONE[profile.sentiment] ?? SENTIMENT_TONE.unclear;

  const subject = `${displayName} — ${propertyLabel} (${sentimentTone.label.split(" —")[0].toLowerCase()})`;

  const contactRows =
    row("Name", profile.fullName) +
    row("Email", profile.email) +
    row("Phone", profile.phone);

  const intentRows =
    row("Move-in", profile.moveInDate) +
    row("Move-out", profile.moveOutDate) +
    row("Lease term", profile.leaseTerm) +
    row("Room type", profile.roomType) +
    row("Budget", profile.budgetMonthly) +
    row("Party", profile.partySize);

  const lifestyleRows =
    row("Occupation", profile.occupation) +
    row("Employer", profile.employer) +
    row("Pets / kids", profile.petsAndKids) +
    row("Reason", profile.reasonForMove);

  const preferenceRows =
    listRow("Must-haves", profile.mustHaves) +
    listRow("Nice-to-haves", profile.niceToHaves) +
    listRow("Comparing", profile.competitorsConsidering);

  const sentimentBadge = `
    <span style="display:inline-block;background:${sentimentTone.bg};color:${sentimentTone.fg};font-size:11px;font-weight:700;letter-spacing:0.04em;padding:4px 10px;border-radius:999px;">
      ${escape(sentimentTone.label)}
    </span>`;

  const body = `
    <p style="margin:0 0 14px 0;color:#111827;font-size:15px;line-height:1.55;">
      <strong>${escape(displayName)}</strong> just chatted with the bot on
      <strong>${escape(propertyLabel)}</strong>. Here's the full profile.
    </p>

    <div style="margin:0 0 18px 0;">${sentimentBadge}</div>

    ${profile.followUpNeeded ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EFF6FF;border-left:3px solid #2563EB;padding:13px 16px;margin:0 0 18px 0;">
      <tr>
        <td>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#1D4ED8;text-transform:uppercase;margin-bottom:5px;">NEXT ACTION</div>
          <div style="font-size:14px;color:#111827;font-weight:500;line-height:1.55;">${escape(profile.followUpNeeded)}</div>
        </td>
      </tr>
    </table>` : ""}

    ${contactRows ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin:0 0 6px 0;">CONTACT</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px 16px;margin:0 0 16px 0;">
      ${contactRows}
    </table>` : ""}

    ${intentRows ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin:0 0 6px 0;">MOVE / LEASE INTENT</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px 16px;margin:0 0 16px 0;">
      ${intentRows}
    </table>` : ""}

    ${lifestyleRows ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin:0 0 6px 0;">CONTEXT</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px 16px;margin:0 0 16px 0;">
      ${lifestyleRows}
    </table>` : ""}

    ${preferenceRows ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin:0 0 6px 0;">PREFERENCES</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px 16px;margin:0 0 16px 0;">
      ${preferenceRows}
    </table>` : ""}

    ${profile.notes ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin:0 0 6px 0;">NOTES</div>
    <p style="margin:0 0 18px 0;padding:13px 16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;color:#111827;font-size:13.5px;line-height:1.55;">${escape(profile.notes)}</p>` : ""}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:6px;">
          <a href="${escape(portalUrl)}"
             style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            Open full transcript
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:18px 0 0 0;color:#9CA3AF;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      ${input.messageCount} messages · last activity ${fmtRel(input.lastMessageAtIso)}${input.pageUrl ? ` · on ${escape(input.pageUrl)}` : ""}
    </p>
  `;

  const html = buildBaseHtml({
    title: subject,
    headline: `${displayName} — ${propertyLabel}`,
    preheader:
      profile.followUpNeeded ||
      `${profile.budgetMonthly} ${profile.roomType} ${profile.moveInDate}`.trim() ||
      "Chatbot prospect profile",
    bodyHtml: body,
  });

  const textParts: string[] = [
    `New chatbot conversation — ${displayName} on ${propertyLabel}`,
    sentimentTone.label,
    "",
  ];
  if (profile.followUpNeeded) {
    textParts.push(`NEXT ACTION: ${profile.followUpNeeded}`, "");
  }
  if (profile.fullName) textParts.push(`Name: ${profile.fullName}`);
  if (profile.email) textParts.push(`Email: ${profile.email}`);
  if (profile.phone) textParts.push(`Phone: ${profile.phone}`);
  textParts.push("");
  if (profile.moveInDate) textParts.push(`Move-in: ${profile.moveInDate}`);
  if (profile.moveOutDate) textParts.push(`Move-out: ${profile.moveOutDate}`);
  if (profile.leaseTerm) textParts.push(`Lease: ${profile.leaseTerm}`);
  if (profile.roomType) textParts.push(`Room: ${profile.roomType}`);
  if (profile.budgetMonthly) textParts.push(`Budget: ${profile.budgetMonthly}`);
  if (profile.partySize) textParts.push(`Party: ${profile.partySize}`);
  textParts.push("");
  if (profile.occupation) textParts.push(`Occupation: ${profile.occupation}`);
  if (profile.employer) textParts.push(`Employer: ${profile.employer}`);
  if (profile.petsAndKids) textParts.push(`Pets/kids: ${profile.petsAndKids}`);
  if (profile.reasonForMove) textParts.push(`Reason: ${profile.reasonForMove}`);
  if (profile.mustHaves && profile.mustHaves.length > 0) {
    textParts.push(`Must-haves: ${profile.mustHaves.join(", ")}`);
  }
  if (profile.niceToHaves && profile.niceToHaves.length > 0) {
    textParts.push(`Nice-to-haves: ${profile.niceToHaves.join(", ")}`);
  }
  if (profile.competitorsConsidering && profile.competitorsConsidering.length > 0) {
    textParts.push(`Comparing: ${profile.competitorsConsidering.join(", ")}`);
  }
  if (profile.notes) {
    textParts.push("", `Notes: ${profile.notes}`);
  }
  textParts.push("", `Open full transcript: ${portalUrl}`);

  return { html, text: textParts.filter(Boolean).join("\n"), subject };
}

// ---------------------------------------------------------------------------
// buildProspectProfileDigestEmail — ONE email covering N chatbot
// conversations. Built specifically for the backfill flow so the agency
// operator gets ONE inbox row instead of N separate emails. Solves two
// problems:
//   1. Recipient-side bulk-mail filters bouncing the burst (Google
//      Workspace flagged N emails to one mailbox in ~30 sec as spam
//      even with spacing).
//   2. Operator UX — scanning one digest is faster than triaging N
//      separate emails on first set-up.
// Used by lib/actions/chatbot-config.ts → backfillChatbotLeadEmails.
// The single-conversation buildProspectProfileEmail above is still used
// for the real-time / handoff / cron paths (one ping per actual
// conversation, naturally spaced).
// ---------------------------------------------------------------------------

export type ProspectProfileDigestEntry = {
  /** Chat session DB id — drives the per-row "Open transcript" link. */
  conversationId: string;
  profile: ProspectProfile;
  messageCount: number;
  lastMessageAtIso: string;
  pageUrl: string | null;
  propertyName: string | null;
};

type ProspectProfileDigestInput = {
  orgName: string;
  portalUrlBase: string;
  entries: ProspectProfileDigestEntry[];
  /** Look-back window in days the operator selected — drives the
   *  subject + headline. */
  dayRange: number;
};

export function buildProspectProfileDigestEmail(
  input: ProspectProfileDigestInput,
): ProspectProfileEmailOutput {
  const { orgName, portalUrlBase, entries, dayRange } = input;
  const count = entries.length;
  const subject = `${count} captured prospect${count === 1 ? "" : "s"} — ${orgName} (last ${dayRange} days)`;

  // Sort hot → warm → lukewarm → cold → unclear so the most actionable
  // rows land at the top of the digest.
  const sentimentOrder = ["hot", "warm", "lukewarm", "cold", "unclear"];
  const sorted = [...entries].sort(
    (a, b) =>
      sentimentOrder.indexOf(a.profile.sentiment) -
      sentimentOrder.indexOf(b.profile.sentiment),
  );

  const rowsHtml = sorted
    .map((entry) => {
      const p = entry.profile;
      const tone = SENTIMENT_TONE[p.sentiment] ?? SENTIMENT_TONE.unclear;
      const displayName =
        p.fullName || p.email || "Anonymous prospect";
      const subLine = [
        p.budgetMonthly,
        p.roomType,
        p.moveInDate,
        p.partySize,
      ]
        .filter((s) => s && s.length > 0)
        .join(" · ");
      const propertyLabel = entry.propertyName ?? "";
      const url = `${portalUrlBase}/portal/conversations/${entry.conversationId}`;
      return `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #E5E7EB;vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:14.5px;font-weight:600;color:#111827;">${escape(displayName)}</div>
                  ${propertyLabel ? `<div style="font-size:11.5px;color:#6B7280;margin-top:2px;">${escape(propertyLabel)}</div>` : ""}
                  ${subLine ? `<div style="font-size:12.5px;color:#374151;margin-top:5px;">${escape(subLine)}</div>` : ""}
                  ${p.followUpNeeded ? `<div style="font-size:12px;color:#1D4ED8;margin-top:6px;"><strong>Next:</strong> ${escape(p.followUpNeeded)}</div>` : ""}
                </td>
                <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">
                  <span style="display:inline-block;background:${tone.bg};color:${tone.fg};font-size:10px;font-weight:700;letter-spacing:0.06em;padding:3px 8px;border-radius:999px;">${escape(tone.label.split(" —")[0])}</span>
                  <div style="margin-top:8px;">
                    <a href="${escape(url)}" style="font-size:12px;color:#2563EB;text-decoration:none;font-weight:600;">Engage →</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  const body = `
    <p style="margin:0 0 14px 0;color:#111827;font-size:15px;line-height:1.55;">
      ${count} chatbot conversation${count === 1 ? "" : "s"} captured leads in the last ${dayRange} day${dayRange === 1 ? "" : "s"}.
      Sorted by sentiment — hottest first. Each row links to the live transcript.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;margin:0 0 22px 0;overflow:hidden;">
      ${rowsHtml}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:6px;">
          <a href="${escape(portalUrlBase)}/portal/conversations"
             style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            Open all conversations
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:18px 0 0 0;color:#9CA3AF;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Backfill digest — sent once per click of the "Catch up on missed leads"
      button on /portal/chatbot. Real-time chatbot leads still land as
      individual emails the moment they happen.
    </p>
  `;

  const html = buildBaseHtml({
    title: subject,
    headline: `${count} captured prospect${count === 1 ? "" : "s"} — ${orgName}`,
    preheader: `Catch-up digest covering ${dayRange} day${dayRange === 1 ? "" : "s"}`,
    bodyHtml: body,
  });

  const textParts: string[] = [
    `${count} captured prospect${count === 1 ? "" : "s"} — ${orgName} (last ${dayRange} days)`,
    "",
  ];
  for (const entry of sorted) {
    const p = entry.profile;
    const displayName = p.fullName || p.email || "Anonymous prospect";
    const tone = SENTIMENT_TONE[p.sentiment] ?? SENTIMENT_TONE.unclear;
    textParts.push(`${tone.label.split(" —")[0]} · ${displayName}`);
    if (entry.propertyName) textParts.push(`  Property: ${entry.propertyName}`);
    if (p.budgetMonthly) textParts.push(`  Budget: ${p.budgetMonthly}`);
    if (p.roomType) textParts.push(`  Room: ${p.roomType}`);
    if (p.moveInDate) textParts.push(`  Move-in: ${p.moveInDate}`);
    if (p.followUpNeeded) textParts.push(`  Next: ${p.followUpNeeded}`);
    textParts.push(
      `  Open: ${portalUrlBase}/portal/conversations/${entry.conversationId}`,
    );
    textParts.push("");
  }

  return { html, text: textParts.join("\n"), subject };
}
