import { escapeHtml, BRAND_NAME } from "@/lib/email/shared";
import { formatChargeDate, formatUsd } from "@/lib/billing/trial-quote";

// ---------------------------------------------------------------------------
// Trial reminder stages and copy (plans/go-live-trial slice 3). Pure; the
// cron in app/api/cron/trial-reminders gathers the inputs and sends.
//
//   day_7      7 days after go-live (or trial start), more than 3 days left:
//              results recap
//   t_minus_3  3 days or fewer left: exact charge + date + manage/cancel
//              (card on file) or "live features pause, your data stays"
//   expired    one-shot soft-landing note
// ---------------------------------------------------------------------------

export type TrialStage = "day_7" | "t_minus_3" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;

export function pickTrialStage(
  now: Date,
  trial: { trialEndsAt: Date; anchor: Date | null; cardOnFile?: boolean },
): TrialStage | null {
  const msLeft = trial.trialEndsAt.getTime() - now.getTime();
  // A card-on-file trial past its end is waiting on Stripe's first invoice
  // (invoice.paid flips it ACTIVE); telling it "paused, nothing charged"
  // would be false.
  if (msLeft < 0) return trial.cardOnFile ? null : "expired";
  if (msLeft <= 3 * DAY_MS) return "t_minus_3";
  if (trial.anchor && now.getTime() - trial.anchor.getTime() >= 7 * DAY_MS) {
    return "day_7";
  }
  return null;
}

// ponytail: US Pacific business hours (weekdays 9-6) for every org; switch to
// a per-property timezone if non-Pacific customers ask about the number.
export function isAfterHours(d: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  if (weekday === "Sat" || weekday === "Sun") return true;
  return hour < 9 || hour >= 18;
}

export type TrialRecap = {
  leads: number;
  conversations: number;
  afterHoursConversations: number;
};

export type TrialReminder = {
  subject: string;
  headline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
};

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export function buildTrialReminder(input: {
  stage: TrialStage;
  recipientName: string;
  orgName: string;
  trialEndsAt: Date;
  planName: string | null;
  monthlyCents: number | null;
  cardOnFile: boolean;
  appUrl: string;
  recap?: TrialRecap;
}): TrialReminder {
  const name = escapeHtml(input.recipientName);
  const org = escapeHtml(input.orgName);
  const date = formatChargeDate(input.trialEndsAt);
  const plan = input.planName ?? "your plan";
  const amount =
    input.monthlyCents !== null ? formatUsd(input.monthlyCents) : null;
  const billingUrl = `${input.appUrl}/portal/billing`;
  const chargeLine = amount
    ? `${amount}/month for ${plan}`
    : `the ${plan} price`;

  if (input.stage === "day_7") {
    const r = input.recap ?? { leads: 0, conversations: 0, afterHoursConversations: 0 };
    const results =
      r.leads + r.conversations > 0
        ? `<p>Since ${org} went live: <strong>${plural(r.leads, "lead", "leads")}</strong> captured and <strong>${plural(r.conversations, "chatbot conversation", "chatbot conversations")}</strong>${r.afterHoursConversations > 0 ? `, ${r.afterHoursConversations.toLocaleString("en-US")} of them after hours when nobody was at the desk` : ""}.</p>`
        : `<p>${org} is set up, but nothing has come through yet. The fastest fix is usually putting the chatbot on your live site. Reply and we'll help you do it today.</p>`;
    const next = input.cardOnFile
      ? `<p>Your card is on file. The first charge of ${chargeLine} is on ${date}.</p>`
      : `<p>Your trial runs through ${date}. Add a card to keep it all running: $0 today, and you can cancel in one click before then.</p>`;
    return {
      subject: `Your first week on ${BRAND_NAME}`,
      headline: "Your first week, in numbers.",
      bodyHtml: `<p>Hi ${name},</p>${results}${next}`,
      ctaText: input.cardOnFile ? "See your dashboard" : "Add a card",
      ctaUrl: input.cardOnFile ? `${input.appUrl}/portal` : billingUrl,
    };
  }

  if (input.stage === "t_minus_3") {
    if (input.cardOnFile) {
      return {
        subject: amount
          ? `${amount} charge on ${date} for ${BRAND_NAME}`
          : `Your ${BRAND_NAME} plan starts ${date}`,
        headline: `Your first charge is on ${date}.`,
        bodyHtml: `<p>Hi ${name},</p><p>Your ${BRAND_NAME} trial for ${org} ends on <strong>${date}</strong>. That day we'll charge the card on file <strong>${chargeLine}</strong>, plus any applicable tax, then monthly after that.</p><p>Want to change or cancel? Do it from your billing page before ${date} and you won't be charged.</p>`,
        ctaText: "Manage or cancel",
        ctaUrl: billingUrl,
      };
    }
    return {
      subject: `Your ${BRAND_NAME} trial ends ${date}`,
      headline: `Your trial ends ${date}.`,
      bodyHtml: `<p>Hi ${name},</p><p>Your ${BRAND_NAME} trial for ${org} ends on ${date}. There's no card on file, so nothing will be charged. Your live features pause on ${date} (the chatbot and visitor pixel), but your data stays: your dashboard and lead history remain readable.</p><p>To keep everything running, add a card: $0 today, then ${chargeLine} starting ${date}. Cancel in one click any time before then.</p>`,
      ctaText: "Add a card",
      ctaUrl: billingUrl,
    };
  }

  return {
    subject: `Your ${BRAND_NAME} live features are paused`,
    headline: "Your trial has ended.",
    bodyHtml: `<p>Hi ${name},</p><p>Your trial for ${org} ended, and nothing was charged. Your chatbot and pixel are paused. Everything else is kept: your dashboard, properties, and lead history are still there to read.</p><p>Reactivate any time to switch them back on (${chargeLine}).</p>`,
    ctaText: "Reactivate",
    ctaUrl: billingUrl,
  };
}
