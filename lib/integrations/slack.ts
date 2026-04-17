/**
 * Slack incoming webhook integration for new intake notifications.
 *
 * Required env var (set in Vercel + .env.local):
 *   SLACK_WEBHOOK_URL, Incoming webhook URL from Slack app settings
 */

import { getSiteUrl } from "@/lib/brand";

export interface NewIntakeData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  propertyType?: string;
  moduleCount?: number;
  intakeId: string;
  appUrl?: string;
}

export function isConfigured(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL;
}

export async function notifyNewIntake(data: NewIntakeData): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const adminUrl = (data.appUrl ?? getSiteUrl()) + `/admin/intakes/${data.intakeId}`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*New intake: ${data.companyName}*` },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Contact:*\n${data.contactName}, ${data.contactEmail}`,
            },
            {
              type: "mrkdwn",
              text: `*Property type:*\n${data.propertyType ?? "unspecified"}`,
            },
            {
              type: "mrkdwn",
              text: `*Modules selected:*\n${data.moduleCount ?? 0}`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Review Intake" },
              url: adminUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Slack webhook ${res.status}: ${await res.text().catch(() => "unknown")}`
    );
  }
}
