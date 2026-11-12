import { describe, expect, it } from "vitest";
import { buildLeadNotifyEmail } from "@/lib/email/lead-notify-email";

const base = {
  orgName: "SG Real Estate",
  subject: "New lead",
  channel: "POPUP" as const,
  propertyName: "The Lair",
  portalUrl: "https://www.leasestack.co/portal/leads/x",
};
const lead = { name: "A", email: "a@b.co", phone: null, sourceLabel: "popup", intent: null };

describe("lead alert email: Came from", () => {
  it("shows the first-touch source when known", () => {
    const out = buildLeadNotifyEmail({ ...base, lead: { ...lead, cameFrom: "Zillow" } } as Parameters<typeof buildLeadNotifyEmail>[0]);
    expect(out.text).toContain("Came from: Zillow");
    expect(out.html).toContain("Came from");
  });
  it("omits the row when unknown", () => {
    const out = buildLeadNotifyEmail({ ...base, lead } as Parameters<typeof buildLeadNotifyEmail>[0]);
    expect(out.text).not.toContain("Came from");
    expect(out.html).not.toContain("Came from");
  });
});
