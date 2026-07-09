import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadNotifyChannel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Regression: the fail-soft Funnel push must NEVER break notifyLeadCaptured.
//
// A Funnel outage / misconfiguration must not throw out of the function AND
// must not prevent the existing Slack/email/bell side-effects from firing.
// Here we make pushLeadToFunnel reject and assert the email still sends and no
// error escapes.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  push: vi.fn(),
  sendBrandedEmail: vi.fn(),
  db: {
    organization: { findUnique: vi.fn() },
    property: { findUnique: vi.fn() },
    leadNotificationDelivery: {
      create: vi.fn(async () => ({ id: "delivery_1" })),
      update: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/integrations/funnel-client", () => ({
  pushLeadToFunnel: h.push,
}));
vi.mock("@/lib/email/shared", () => ({
  sendBrandedEmail: h.sendBrandedEmail,
  APP_URL: "https://app.test",
}));
vi.mock("@/lib/email/lead-notify-email", () => ({
  buildLeadNotifyEmail: () => ({ html: "<p>lead</p>", text: "lead" }),
}));

import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

const ORG = {
  name: "Acme Property Co",
  shortName: "Acme",
  notifyLeadEmail: "owner@acme.test",
  notifyLeadCcEmail: null,
  notifyLeadBccEmail: null,
  notifyOnChatbotLead: true,
  notifyOnPopupLead: true,
  notifyOnFormLead: true,
  notifyOnIngestLead: true,
  notifyOnTourRequest: true,
  notifyOnVisitorConvert: true,
  notifyOnManualLead: true,
};

// A POPUP lead is a complete event at capture time (no transcript to wait for),
// so it pushes to Funnel INLINE from notifyLeadCaptured — the right channel to
// prove the fail-soft guarantee on. Chatbot leads are handled separately by the
// funnel-lead-sync cron (see the CHATBOT deferral test below).
const INPUT = {
  orgId: "org_1",
  leadId: "lead_1",
  propertyId: null,
  channel: LeadNotifyChannel.POPUP,
  lead: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-1234",
    sourceLabel: "Popup on /pricing",
  },
  conversationId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.db.organization.findUnique.mockResolvedValue(ORG);
  h.db.property.findUnique.mockResolvedValue(null);
  h.db.leadNotificationDelivery.create.mockResolvedValue({ id: "delivery_1" });
  h.db.leadNotificationDelivery.update.mockResolvedValue({});
  h.sendBrandedEmail.mockResolvedValue({ ok: true, id: "resend_1" });
});

describe("notifyLeadCaptured — Funnel push is fail-soft", () => {
  it("does not throw and still sends email when the Funnel push REJECTS", async () => {
    h.push.mockRejectedValue(new Error("Funnel API 500"));

    await expect(notifyLeadCaptured(INPUT)).resolves.toBeUndefined();

    // The Funnel push was attempted...
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        channel: LeadNotifyChannel.POPUP,
      }),
    );
    // ...and the email side-effect fired regardless.
    expect(h.sendBrandedEmail).toHaveBeenCalledTimes(1);
    expect(h.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner@acme.test"] }),
    );
  });

  it("still sends email when the Funnel push resolves a soft skip (not connected)", async () => {
    h.push.mockResolvedValue({ ok: false, skipped: true, reason: "not enabled" });

    await expect(notifyLeadCaptured(INPUT)).resolves.toBeUndefined();

    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.sendBrandedEmail).toHaveBeenCalledTimes(1);
  });

  it("fires the Funnel push even when the email channel is suppressed", async () => {
    // Channel disabled for the org → email is suppressed, but the CRM push is
    // its own side-effect and must still attempt.
    h.db.organization.findUnique.mockResolvedValue({
      ...ORG,
      notifyOnPopupLead: false,
    });
    h.push.mockResolvedValue({ ok: true });

    await expect(notifyLeadCaptured(INPUT)).resolves.toBeUndefined();

    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.sendBrandedEmail).not.toHaveBeenCalled();
  });
});

describe("notifyLeadCaptured — CHATBOT leads are NOT pushed inline", () => {
  it("defers chatbot leads to the funnel-lead-sync cron (no inline push)", async () => {
    // A chatbot lead is captured before / partway through the conversation, so
    // an inline push would send Funnel an empty/partial transcript — and
    // Funnel's POST /clients has no upsert, so we can't re-push. Chatbot leads
    // must therefore be pushed ONCE by the idle cron, never inline here. The
    // operator's email notification still fires immediately.
    h.push.mockResolvedValue({ ok: true });

    await expect(
      notifyLeadCaptured({
        ...INPUT,
        channel: LeadNotifyChannel.CHATBOT,
        lead: { ...INPUT.lead, sourceLabel: "Chatbot on /apartments" },
        conversationId: "conv_1",
      }),
    ).resolves.toBeUndefined();

    // No inline CRM push for chatbot...
    expect(h.push).not.toHaveBeenCalled();
    // ...but the operator email still went out.
    expect(h.sendBrandedEmail).toHaveBeenCalledTimes(1);
  });
});
