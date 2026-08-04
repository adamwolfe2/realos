export type ClaimPolicy = Readonly<{
  severity: "critical" | "warning";
  owner: "marketing" | "product" | "legal";
  reason: string;
}>;

export const UNSUPPORTED_CLAIM_POLICIES: Readonly<Record<string, ClaimPolicy>> =
  Object.freeze({
    "features.ads.managed-end-to-end": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack is software and does not operate advertising for customers.",
    },
    "features.ads.weekly-creative-refresh": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack does not sell an ongoing creative-production service.",
    },
    "home.hero.universal-attribution": {
      severity: "critical",
      owner: "marketing",
      reason: "Attribution must disclose measured coverage and cannot promise every outcome.",
    },
    "features.ads.universal-attribution": {
      severity: "critical",
      owner: "marketing",
      reason: "Paid-media attribution cannot guarantee every dollar maps to a signed lease.",
    },
    "home.faq.every-major-pms": {
      severity: "critical",
      owner: "marketing",
      reason: "PMS support is capability-specific and several listed connectors are not live.",
    },
    "home.faq.ads-start-running": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack does not launch or manage customer advertising.",
    },
  });
