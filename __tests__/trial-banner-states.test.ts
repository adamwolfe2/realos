import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrialBanner } from "@/components/portal/trial-banner";
import { trialQuote } from "@/lib/billing/trial-quote";

// Copy contract for the go-live card prompt (plans/go-live-trial slice 2):
// the banner must state $0 today, the exact first charge, and its date.

const DAY = 24 * 60 * 60 * 1000;
const ends = new Date(Date.now() + 10 * DAY);
const quote = trialQuote("GROWTH", 1);
const render = (over: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(TrialBanner, {
      trialEndsAt: ends,
      propertyCount: 1,
      tier: "GROWTH",
      live: false,
      cardOnFile: false,
      quote,
      canManageBilling: true,
      ...over,
    }),
  ).replace(/<!-- -->/g, "");

describe("TrialBanner", () => {
  it("before go-live says the clock starts at go-live", () => {
    const html = render({});
    expect(html).toContain("Your 14-day trial starts when you go live");
    expect(html).not.toContain("first charge");
  });

  it("at go-live asks for a card with $0 today, amount, and date", () => {
    const html = render({ live: true });
    expect(html).toContain("You&#x27;re live.");
    expect(html).toContain("$0 today, first charge of $899 on");
    expect(html).toContain("cancel in one click");
    expect(html).toContain("Add card");
  });

  it("with a card on file shows the charge and a manage/cancel link, no add-card", () => {
    const html = render({ live: true, cardOnFile: true });
    expect(html).toContain("First charge of $899 on");
    expect(html).toContain("Manage or cancel");
    expect(html).not.toContain("Add card");
  });

  it("non-owners get a billing link, not the checkout button", () => {
    const html = render({ live: true, canManageBilling: false });
    expect(html).not.toContain("Add card");
    expect(html).toContain('href="/portal/billing"');
  });
});

describe("TrialBanner soft landing", () => {
  it("expired: says nothing was charged, what paused, what stays, and that reactivating charges today", () => {
    const html = render({ trialEndsAt: new Date(Date.now() - DAY), live: true });
    expect(html).toContain("nothing was charged");
    expect(html).toContain("chatbot and");
    expect(html).toContain("Your data is still");
    expect(html).toContain("read-only");
    expect(html).toContain("Reactivate for $899/month, starting today.");
    expect(html).toContain("Reactivate");
  });

  it("card on file past trial end shows the charge state, not the lapsed state", () => {
    const html = render({ trialEndsAt: new Date(Date.now() - 60_000), live: true, cardOnFile: true });
    expect(html).not.toContain("nothing was charged");
    expect(html).not.toContain("Reactivate");
    expect(html).toContain("Manage or cancel");
  });
});
