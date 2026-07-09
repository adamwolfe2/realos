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

const INPUT = {
  orgId: "org_1",
  leadId: "lead_1",
  propertyId: null,
  channel: LeadNotifyChannel.CHATBOT,
  lead: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-1234",
    sourceLabel: "Chatbot on /apartments",
  },
  conversationId: "conv_1",
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
        channel: LeadNotifyChannel.CHATBOT,
        conversationId: "conv_1",
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
      notifyOnChatbotLead: false,
    });
    h.push.mockResolvedValue({ ok: true });

    await expect(notifyLeadCaptured(INPUT)).resolves.toBeUndefined();

    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.sendBrandedEmail).not.toHaveBeenCalled();
  });
});
