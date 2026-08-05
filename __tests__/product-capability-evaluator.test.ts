import { describe, expect, it } from "vitest";
import { PRODUCT_KEYS } from "@/lib/products/registry";
import { PRODUCT_CAPABILITY_CONTRACTS } from "@/lib/products/capabilities/contracts";
import {
  CapabilityScopeError,
  evaluateCapabilityProfile,
} from "@/lib/products/capabilities/evaluate";
import type {
  CapabilityContract,
  CapabilityEvidence,
  CapabilitySignal,
  CapabilitySignalKey,
  CapabilitySubject,
} from "@/lib/products/capabilities/types";

const NOW = new Date("2026-08-04T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

const propertySubject: CapabilitySubject = {
  scope: "property",
  orgId: "org-a",
  propertyId: "property-a",
};

function evidence(
  kind: CapabilityEvidence["kind"],
  observedAt = NOW,
): CapabilityEvidence {
  return { kind, observedAt };
}

function signal(
  key: CapabilitySignalKey,
  state: CapabilitySignal["state"],
  options: {
    subject?: CapabilitySubject;
    evidence?: readonly CapabilityEvidence[];
  } = {},
): CapabilitySignal {
  return {
    key,
    state,
    subject: options.subject ?? propertySubject,
    evidence: options.evidence ?? [],
  };
}

function contract(
  overrides: Partial<CapabilityContract> = {},
): CapabilityContract {
  return {
    productKey: "ai-leasing-chatbot",
    subjectScopes: ["property"],
    requirements: [
      {
        key: "live-proof",
        label: "Live proof",
        kind: "activation",
        satisfaction: "all",
        impact: "required",
        signalKeys: ["outcome.chatbot_conversation"],
        acceptedScope: "exact_property",
        requiredEvidence: ["outcome"],
        proofSummary: "A recent property conversation was verified.",
        blockerSummary: "Verify a conversation on this property's live site.",
        actionHref: "/portal/chatbot",
      },
    ],
    ...overrides,
  };
}

describe("product capability contracts", () => {
  it("defines a contract for every canonical product key and no orphan keys", () => {
    expect(Object.keys(PRODUCT_CAPABILITY_CONTRACTS)).toEqual(PRODUCT_KEYS);
    for (const productContract of Object.values(PRODUCT_CAPABILITY_CONTRACTS)) {
      expect(PRODUCT_KEYS).toContain(productContract.productKey);
    }
  });

  it("requires activation proof beyond setup for every product contract", () => {
    for (const productContract of Object.values(PRODUCT_CAPABILITY_CONTRACTS)) {
      expect(
        productContract.requirements.some(
          ({ kind, impact }) => kind === "activation" && impact === "required",
        ),
        productContract.productKey,
      ).toBe(true);
    }
  });
});

describe("evaluateCapabilityProfile — tenant scope", () => {
  it("throws on foreign-organization evidence instead of ignoring it", () => {
    const foreignSignal = signal("outcome.chatbot_conversation", "ready", {
      subject: {
        scope: "property",
        orgId: "org-b",
        propertyId: "property-a",
      },
      evidence: [evidence("outcome")],
    });

    expect(() =>
      evaluateCapabilityProfile(contract(), propertySubject, [foreignSignal], NOW),
    ).toThrow(CapabilityScopeError);
  });

  it("throws on sibling-property evidence instead of broadening scope", () => {
    const siblingSignal = signal("outcome.chatbot_conversation", "ready", {
      subject: {
        scope: "property",
        orgId: "org-a",
        propertyId: "property-b",
      },
      evidence: [evidence("outcome")],
    });

    expect(() =>
      evaluateCapabilityProfile(contract(), propertySubject, [siblingSignal], NOW),
    ).toThrow(/sibling property/i);
  });

  it("does not let org-wide evidence satisfy an exact-property requirement", () => {
    const orgSignal = signal("outcome.chatbot_conversation", "ready", {
      subject: { scope: "organization", orgId: "org-a" },
      evidence: [evidence("outcome")],
    });

    const profile = evaluateCapabilityProfile(
      contract(),
      propertySubject,
      [orgSignal],
      NOW,
    );

    expect(profile.status).toBe("disconnected");
    expect(profile.blockers.map(({ code }) => code)).toContain("disconnected");
  });

  it("allows org-wide evidence only when the requirement explicitly permits it", () => {
    const orgSignal = signal("outcome.chatbot_conversation", "ready", {
      subject: { scope: "organization", orgId: "org-a" },
      evidence: [evidence("outcome")],
    });
    const permissive = contract({
      requirements: [
        {
          ...contract().requirements[0],
          acceptedScope: "either",
        },
      ],
    });

    const profile = evaluateCapabilityProfile(
      permissive,
      propertySubject,
      [orgSignal],
      NOW,
    );

    expect(profile.status).toBe("ready");
  });
});

describe("evaluateCapabilityProfile — proof and requirement semantics", () => {
  it("supports any-of requirements", () => {
    const anyContract = contract({
      requirements: [
        {
          ...contract().requirements[0],
          key: "search-source",
          kind: "integration",
          satisfaction: "any",
          signalKeys: ["integration.ga4", "integration.gsc"],
          requiredEvidence: ["sync"],
        },
      ],
    });

    const profile = evaluateCapabilityProfile(
      anyContract,
      propertySubject,
      [signal("integration.gsc", "ready", { evidence: [evidence("sync")] })],
      NOW,
    );

    expect(profile.status).toBe("ready");
  });

  it("supports all-of requirements", () => {
    const allContract = contract({
      requirements: [
        {
          ...contract().requirements[0],
          key: "chatbot-outcome",
          satisfaction: "all",
          signalKeys: [
            "outcome.chatbot_conversation",
            "outcome.chatbot_lead",
          ],
        },
      ],
    });

    const profile = evaluateCapabilityProfile(
      allContract,
      propertySubject,
      [
        signal("outcome.chatbot_conversation", "ready", {
          evidence: [evidence("outcome")],
        }),
      ],
      NOW,
    );

    expect(profile.status).toBe("disconnected");
  });

  it("does not treat configuration or entitlement-like setup as readiness", () => {
    const chatbotContract = PRODUCT_CAPABILITY_CONTRACTS["ai-leasing-chatbot"];
    const setupOnly = [
      signal("setup.chatbot_configured", "ready", {
        evidence: [evidence("configuration")],
      }),
      signal("setup.notification_recipient", "ready", {
        subject: { scope: "organization", orgId: "org-a" },
        evidence: [evidence("configuration")],
      }),
    ];

    const profile = evaluateCapabilityProfile(
      chatbotContract,
      propertySubject,
      setupOnly,
      NOW,
    );

    expect(profile.status).toBe("disconnected");
    expect(profile.blockers.some(({ requirementKey }) => requirementKey === "live-chatbot-proof")).toBe(true);
  });

  it("requires typed evidence even when a signal claims ready", () => {
    const profile = evaluateCapabilityProfile(
      contract(),
      propertySubject,
      [signal("outcome.chatbot_conversation", "ready")],
      NOW,
    );

    expect(profile.status).toBe("disconnected");
    expect(profile.blockers.map(({ code }) => code)).toContain("missing_evidence");
  });
});

describe("evaluateCapabilityProfile — lifecycle and blockers", () => {
  it.each([
    ["error", "needs_attention"],
    ["stale", "needs_attention"],
    ["backfilling", "backfilling"],
    ["verifying", "verifying"],
    ["disconnected", "disconnected"],
    ["unsupported", "needs_attention"],
    ["partial", "needs_attention"],
  ] as const)("maps required %s signals to %s", (signalState, expected) => {
    const profile = evaluateCapabilityProfile(
      contract(),
      propertySubject,
      [signal("outcome.chatbot_conversation", signalState)],
      NOW,
    );

    expect(profile.status).toBe(expected);
  });

  it("marks unsupported degraded lanes partially ready", () => {
    const mixedContract = contract({
      requirements: [
        contract().requirements[0],
        {
          ...contract().requirements[0],
          key: "optional-lease-lane",
          label: "Lease lane",
          kind: "integration",
          impact: "degraded",
          signalKeys: ["integration.appfolio_leases"],
          requiredEvidence: ["sync"],
        },
      ],
    });

    const profile = evaluateCapabilityProfile(
      mixedContract,
      propertySubject,
      [
        signal("outcome.chatbot_conversation", "ready", {
          evidence: [evidence("outcome")],
        }),
        signal("integration.appfolio_leases", "unsupported"),
      ],
      NOW,
    );

    expect(profile.status).toBe("partially_ready");
    expect(profile.blockers.map(({ code }) => code)).toContain("unsupported");
  });

  it("uses the injected clock to reject expired evidence deterministically", () => {
    const freshnessContract = contract({
      requirements: [
        {
          ...contract().requirements[0],
          maxEvidenceAgeMs: HOUR_MS,
        },
      ],
    });
    const oldEvidence = evidence(
      "outcome",
      new Date(NOW.getTime() - 2 * HOUR_MS),
    );

    const profile = evaluateCapabilityProfile(
      freshnessContract,
      propertySubject,
      [
        signal("outcome.chatbot_conversation", "ready", {
          evidence: [oldEvidence],
        }),
      ],
      NOW,
    );

    expect(profile.status).toBe("needs_attention");
    expect(profile.blockers.map(({ code }) => code)).toContain("stale");
  });

  it("deduplicates and sorts blockers without copying input error text", () => {
    const duplicateRequirements = contract({
      requirements: [
        {
          ...contract().requirements[0],
          key: "z-proof",
          blockerSummary: "Verify live product proof.",
        },
        {
          ...contract().requirements[0],
          key: "a-proof",
          blockerSummary: "Verify live product proof.",
        },
        {
          ...contract().requirements[0],
          key: "a-proof",
          blockerSummary: "Verify live product proof.",
        },
      ],
    });

    const profile = evaluateCapabilityProfile(
      duplicateRequirements,
      propertySubject,
      [signal("outcome.chatbot_conversation", "error")],
      NOW,
    );

    expect(profile.blockers.map(({ requirementKey }) => requirementKey)).toEqual([
      "a-proof",
      "z-proof",
    ]);
    expect(new Set(profile.blockers.map(({ code, requirementKey }) => `${code}:${requirementKey}`)).size).toBe(profile.blockers.length);
    expect(JSON.stringify(profile)).not.toContain("provider error");
  });
});
