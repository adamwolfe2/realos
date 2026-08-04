import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as string[],
  requireAgencyStaffRead: vi.fn(async () => {
    h.calls.push("auth");
    return {};
  }),
  loadClientActivation: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound() called");
  }),
}));

vi.mock("@/lib/tenancy/scope", () => ({
  requireAgencyStaffRead: h.requireAgencyStaffRead,
}));

vi.mock("@/lib/admin/client-activation", () => ({
  loadClientActivation: (...args: unknown[]) => {
    h.calls.push("load");
    return h.loadClientActivation(...args);
  },
}));

vi.mock("next/navigation", () => ({ notFound: h.notFound }));

import ActivationPage from "@/app/admin/clients/[id]/activation/page";
import {
  CLIENT_TAB_KEYS,
  ClientDetailTabs,
} from "@/app/admin/clients/[id]/client-detail-tabs";

const PRODUCT_ROWS = [
  ["connected-data-foundation", "Connected Data Foundation", "included", "ready"],
  ["lead-to-lease-attribution", "Lead-to-Lease Attribution", "included", "partially_ready"],
  ["ai-leasing-chatbot", "AI Leasing Chatbot", "enabled", "ready"],
  ["conversion-offers", "Conversion Offers", "not_enabled", "disconnected"],
  ["reputation-rescue", "Reputation Rescue", "enabled", "needs_attention"],
  ["search-opportunity-engine", "Search Opportunity Engine", "enabled", "verifying"],
  ["monday-action-brief", "Monday Action Brief", "enabled", "backfilling"],
  ["website-build", "Website Build", "concierge", "disconnected"],
] as const;

function activationView() {
  return {
    client: { id: "org-client-1", name: "SG Real Estate", propertyCount: 8 },
    rows: PRODUCT_ROWS.map(([key, name, access, status], index) => ({
      key,
      name,
      promise: `${name} produces a verified operator outcome.`,
      access,
      status,
      coverage: {
        ready: index === 0 ? 6 : index % 3,
        total: 8,
        label: index === 0 ? "6 of 8 verified" : `${index % 3} of 8 verified`,
      },
      proof: index === 0 ? "Fresh property-scoped records verified." : "Proof not recorded.",
      blockers: index === 0 ? [] : ["Complete the required activation proof."],
      action: {
        label: index === 0 ? "Review integrations" : "Continue setup",
        href: `/admin/clients/org-client-1?tab=${index === 0 ? "integrations" : "modules"}`,
      },
    })),
  };
}

describe("admin client Activation page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.calls.length = 0;
    h.loadClientActivation.mockResolvedValue(activationView());
  });

  it("authorizes staff before loading and renders all eight canonical products", async () => {
    const page = await ActivationPage({
      params: Promise.resolve({ id: "org-client-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(h.calls).toEqual(["auth", "load"]);
    expect(h.loadClientActivation).toHaveBeenCalledWith(
      "org-client-1",
      expect.any(Date),
    );
    expect(html).toContain("Product activation");
    expect(html).toContain("<table");
    expect(html).toContain("Product");
    expect(html).toContain("Access");
    expect(html).toContain("Activation state");
    expect(html).toContain("Property coverage");
    expect(html).toContain("Proof");
    expect(html).toContain("Next action");
    for (const [, name] of PRODUCT_ROWS) expect(html).toContain(name);
  });

  it("uses labelled read-only links and keeps blocker copy visible", async () => {
    const page = await ActivationPage({
      params: Promise.resolve({ id: "org-client-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("6 of 8 verified");
    expect(html).toContain("Fresh property-scoped records verified.");
    expect(html).toContain("Complete the required activation proof.");
    expect(html).toContain('href="/admin/clients/org-client-1?tab=integrations"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });

  it("fails closed with notFound when the requested client is missing", async () => {
    h.loadClientActivation.mockResolvedValueOnce(null);

    await expect(
      ActivationPage({ params: Promise.resolve({ id: "missing-client" }) }),
    ).rejects.toThrow("notFound() called");

    expect(h.calls).toEqual(["auth", "load"]);
    expect(h.notFound).toHaveBeenCalledOnce();
  });

  it("places the isolated Activation route between Overview and Integrations", () => {
    const html = renderToStaticMarkup(
      React.createElement(ClientDetailTabs, {
        orgId: "org-client-1",
        active: "activation",
        propertiesCount: 8,
        failingSyncCount: 0,
      }),
    );

    expect(html).toContain('href="/admin/clients/org-client-1/activation"');
    expect(html).toContain('aria-current="page"');
    expect(CLIENT_TAB_KEYS).not.toContain("activation");
    expect(html.indexOf("Overview")).toBeLessThan(html.indexOf("Activation"));
    expect(html.indexOf("Activation")).toBeLessThan(html.indexOf("Integrations"));
  });
});
