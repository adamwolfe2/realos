import { describe, it, expect } from "vitest";
import {
  pickTrialStage,
  buildTrialReminder,
  isAfterHours,
} from "@/lib/billing/trial-reminders";

// plans/go-live-trial slice 3. Honest reminders: day-7 results recap; three
// days out, the exact charge and date (card) or what pauses and what stays
// (no card); a soft-landing note at expiry.

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-10T17:00:00Z");
const plus = (d: number) => new Date(now.getTime() + d * DAY);

describe("pickTrialStage", () => {
  it("sends the recap 7 days after go-live when more than 3 days remain", () => {
    expect(pickTrialStage(now, { trialEndsAt: plus(7), anchor: plus(-7) })).toBe("day_7");
    expect(pickTrialStage(now, { trialEndsAt: plus(7), anchor: plus(-6) })).toBeNull();
  });
  it("sends T-3 at three days or fewer", () => {
    expect(pickTrialStage(now, { trialEndsAt: plus(3), anchor: plus(-11) })).toBe("t_minus_3");
    expect(pickTrialStage(now, { trialEndsAt: plus(0.5), anchor: plus(-13) })).toBe("t_minus_3");
  });
  it("skips the recap when T-3 is already due (late go-live)", () => {
    expect(pickTrialStage(now, { trialEndsAt: plus(2), anchor: plus(-8) })).toBe("t_minus_3");
  });
  it("marks expired trials", () => {
    expect(pickTrialStage(now, { trialEndsAt: plus(-1), anchor: plus(-15) })).toBe("expired");
  });
  it("never sends the expired note to a card-on-file trial awaiting its first invoice", () => {
    expect(
      pickTrialStage(now, { trialEndsAt: plus(-0.1), anchor: plus(-14), cardOnFile: true }),
    ).toBeNull();
  });
});

describe("isAfterHours (US Pacific)", () => {
  it("counts evenings and weekends, not weekday business hours", () => {
    expect(isAfterHours(new Date("2026-10-07T20:00:00Z"))).toBe(false); // Wed 1pm PT
    expect(isAfterHours(new Date("2026-10-08T04:00:00Z"))).toBe(true); // Wed 9pm PT
    expect(isAfterHours(new Date("2026-10-10T19:00:00Z"))).toBe(true); // Sat noon PT
  });
});

const base = {
  recipientName: "Dana",
  orgName: "Oak & <Pine>",
  trialEndsAt: new Date("2026-10-14T18:00:00Z"),
  planName: "Growth",
  monthlyCents: 89900,
  appUrl: "https://app.test",
};

describe("buildTrialReminder", () => {
  it("day 7 recaps results", () => {
    const r = buildTrialReminder({
      ...base,
      stage: "day_7",
      cardOnFile: false,
      recap: { leads: 12, conversations: 40, afterHoursConversations: 17 },
    });
    expect(r.bodyHtml).toContain("12 leads");
    expect(r.bodyHtml).toContain("17 of them after hours");
    expect(r.bodyHtml).toContain("Oak &amp; &lt;Pine&gt;");
  });

  it("T-3 with a card states the exact charge, date, and a manage/cancel link", () => {
    const r = buildTrialReminder({ ...base, stage: "t_minus_3", cardOnFile: true });
    expect(r.subject).toContain("$899");
    expect(r.bodyHtml).toContain("$899");
    expect(r.bodyHtml).toContain("October 14, 2026");
    expect(r.ctaText).toBe("Manage or cancel");
    expect(r.ctaUrl).toBe("https://app.test/portal/billing");
  });

  it("T-3 without a card says live features pause and data stays", () => {
    const r = buildTrialReminder({ ...base, stage: "t_minus_3", cardOnFile: false });
    expect(r.bodyHtml).toContain("live features pause on October 14, 2026");
    expect(r.bodyHtml).toContain("your data stays");
    expect(r.bodyHtml).toContain("$0 today");
  });

  it("expired copy is the soft landing, not a lockout", () => {
    const r = buildTrialReminder({ ...base, stage: "expired", cardOnFile: false });
    expect(r.bodyHtml).toContain("paused");
    expect(r.bodyHtml).toContain("lead history");
    expect(r.ctaText).toBe("Reactivate");
  });
});
