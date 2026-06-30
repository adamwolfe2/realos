import "server-only";

// ---------------------------------------------------------------------------
// Minimal Slack webhook poster. Reads SLACK_WEBHOOK_URL (incoming webhook,
// any channel — set the webhook target in the Slack app config). When the
// env var is unset we no-op silently so local/dev environments don't have
// to configure Slack to run the app.
// ---------------------------------------------------------------------------

type SlackResult = { ok: boolean; skipped?: boolean; error?: string };

export interface SlackMessage {
  text: string;
  /** Slack Block Kit blocks. If provided, takes precedence over `text` for rendering. */
  blocks?: unknown[];
}

export async function postSlack(message: SlackMessage): Promise<SlackResult> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return { ok: true, skipped: true };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[slack] non-2xx response:", res.status, body);
      return { ok: false, error: `Slack webhook returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[slack] fetch threw:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown Slack error",
    };
  }
}

export interface SiteRequestSlackInput {
  brandName: string;
  submitterName: string;
  submitterEmail: string;
  tier: string;
  source: string | null;
  identityType: string | null;
  timeline: string | null;
  adminUrl: string;
}

export async function notifySiteRequestSubmitted(
  input: SiteRequestSlackInput,
): Promise<SlackResult> {
  const text = `🌐 New site request: *${input.brandName}* (${input.tier}) — ${input.adminUrl}`;
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New site request: ${input.brandName}`,
        emoji: false,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Submitter*\n${input.submitterName}` },
        { type: "mrkdwn", text: `*Email*\n${input.submitterEmail}` },
        { type: "mrkdwn", text: `*Tier*\n${input.tier}` },
        { type: "mrkdwn", text: `*Source*\n${input.source ?? "direct"}` },
        {
          type: "mrkdwn",
          text: `*Identity*\n${input.identityType ?? "—"}`,
        },
        { type: "mrkdwn", text: `*Timeline*\n${input.timeline ?? "—"}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in admin", emoji: false },
          url: input.adminUrl,
          style: "primary",
        },
      ],
    },
  ];
  return postSlack({ text, blocks });
}
