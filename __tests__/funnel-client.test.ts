import { describe, it, expect, vi } from "vitest";
import { LeadNotifyChannel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Pure-function tests for the Funnel Leasing payload builder. buildFunnel-
// ProspectPayload has NO network / DB dependency — but the module it lives in
// pulls prisma + the vault crypto for the push helper, so we stub those to keep
// the import side-effect-free and the test hermetic.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/vault/crypto", () => ({
  encryptForOrg: vi.fn(),
  decryptForOrg: vi.fn(),
}));

import {
  buildFunnelProspectPayload,
  formatConversationNotes,
} from "@/lib/integrations/funnel-client";

const baseConfig = { groupId: 1234 };

describe("buildFunnelProspectPayload", () => {
  it("builds the exact {client:{…}} shape on the happy path", () => {
    const payload = buildFunnelProspectPayload({
      lead: {
        name: "Jane Doe",
        email: "Jane@Example.com",
        phone: "555-1234",
        sourceLabel: "Popup on /pricing",
      },
      channel: LeadNotifyChannel.POPUP,
      config: { groupId: 1234, discoverySourceId: "src_9" },
    });

    expect(payload.client.first_name).toBe("Jane");
    expect(payload.client.last_name).toBe("Doe");
    // Email is normalized to lowercase.
    expect(payload.client.email).toBe("jane@example.com");
    expect(payload.client.group).toBe(1234);
    expect(payload.client.phone_1).toBe("555-1234");
    expect(payload.client.source_type).toBe("Popup on /pricing");
    expect(payload.client.discovery_source_id).toBe("src_9");
    // A primary person is always included.
    expect(payload.client.people).toHaveLength(1);
    expect(payload.client.people[0]).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone_1: "555-1234",
      is_primary: true,
    });
  });

  it("omits optional fields when absent and falls back a missing last name", () => {
    const payload = buildFunnelProspectPayload({
      lead: { name: "Cher", email: "cher@example.com" },
      channel: LeadNotifyChannel.FORM,
      config: baseConfig,
    });

    // Single-token name → placeholder last name (Funnel rejects empty).
    expect(payload.client.first_name).toBe("Cher");
    expect(payload.client.last_name).toBe("—");
    // No phone / source / discovery id when not supplied.
    expect(payload.client.phone_1).toBeUndefined();
    expect(payload.client.source_type).toBeUndefined();
    expect(payload.client.discovery_source_id).toBeUndefined();
    expect(payload.client.people[0].phone_1).toBeUndefined();
    // Non-chatbot channel still gets a short descriptive note.
    expect(payload.client.notes).toContain("form");
  });

  it("folds the chatbot transcript into notes for CHATBOT leads", () => {
    const payload = buildFunnelProspectPayload({
      lead: {
        name: "Sam Smith",
        email: "sam@example.com",
        sourceLabel: "Chatbot on /apartments",
      },
      channel: LeadNotifyChannel.CHATBOT,
      config: baseConfig,
      conversation: {
        messages: [
          { role: "assistant", content: "Hi! How can I help?" },
          { role: "user", content: "Do you allow pets?" },
          { role: "assistant", content: "Yes, cats and dogs are welcome." },
          // Blank turns are dropped.
          { role: "user", content: "   " },
        ],
      },
    });

    expect(payload.client.notes).toContain("LeaseStack chatbot conversation");
    expect(payload.client.notes).toContain("Chatbot on /apartments");
    expect(payload.client.notes).toContain("Assistant: Hi! How can I help?");
    expect(payload.client.notes).toContain("Prospect: Do you allow pets?");
    // Empty message content is not rendered as a blank line.
    expect(payload.client.notes).not.toMatch(/Prospect:\s*$/m);
  });

  it("throws when email is missing (caller treats as a soft skip)", () => {
    expect(() =>
      buildFunnelProspectPayload({
        lead: { name: "No Email", email: "" },
        channel: LeadNotifyChannel.FORM,
        config: baseConfig,
      }),
    ).toThrow(/email/i);
  });

  it("throws when the group id is not an integer", () => {
    expect(() =>
      buildFunnelProspectPayload({
        lead: { name: "Jane Doe", email: "jane@example.com" },
        channel: LeadNotifyChannel.FORM,
        // @ts-expect-error — intentionally invalid to prove the guard fires
        config: { groupId: undefined },
      }),
    ).toThrow(/group/i);
  });
});

describe("formatConversationNotes", () => {
  it("returns just the header when there are no usable messages", () => {
    const note = formatConversationNotes({ messages: [] }, "Chatbot on /x");
    expect(note).toBe("LeaseStack chatbot conversation — Chatbot on /x");
  });

  it("labels roles as Assistant / Prospect", () => {
    const note = formatConversationNotes(
      {
        messages: [
          { role: "bot", content: "Welcome" },
          { role: "visitor", content: "Hello" },
        ],
      },
      null,
    );
    expect(note).toContain("Assistant: Welcome");
    expect(note).toContain("Prospect: Hello");
  });
});
