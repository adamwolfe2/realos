import { describe, it, expect } from "vitest";
import { summarizeGroup } from "@/lib/insights/summarize-group";

// ---------------------------------------------------------------------------
// summarizeGroup powers the GroupedInsights collapser on the weekly report
// (and any other surface that needs to fold N identical insights into one
// row). The strings here go straight into the operator + client-facing
// report — typos and weirdly-worded fallbacks are visible to the
// customer.
// ---------------------------------------------------------------------------

describe("summarizeGroup", () => {
  // ── Specific kind branches ───────────────────────────────────────────────

  it("portfolio_outlier:info → 'priced below portfolio average'", () => {
    const r = summarizeGroup("portfolio_outlier", "info", 5);
    expect(r.title).toBe("5 properties priced below portfolio average");
    expect(r.body).toMatch(/renewing.*portfolio average/i);
  });

  it("portfolio_outlier:warning → 'priced above portfolio with open vacancy'", () => {
    const r = summarizeGroup("portfolio_outlier", "warning", 2);
    expect(r.title).toBe(
      "2 properties priced above portfolio with open vacancy",
    );
    expect(r.body).toMatch(/local market/i);
  });

  it("portfolio_outlier with unknown severity falls through to above-portfolio copy", () => {
    // Defensive: if a new severity ships before this is updated, the
    // fall-through still produces a coherent line rather than crashing.
    const r = summarizeGroup("portfolio_outlier", "critical", 3);
    expect(r.title).toMatch(/3 properties priced above portfolio/);
  });

  it("pipeline_stall → 'leads stuck in pipeline'", () => {
    const r = summarizeGroup("pipeline_stall", "warning", 8);
    expect(r.title).toBe("8 leads stuck in pipeline");
  });

  it("negative_review → 'new negative reviews'", () => {
    const r = summarizeGroup("negative_review", "warning", 4);
    expect(r.title).toBe("4 new negative reviews");
  });

  it("hot_visitor → 'hot visitors flagged'", () => {
    const r = summarizeGroup("hot_visitor", "info", 6);
    expect(r.title).toBe("6 hot visitors flagged");
  });

  it("keyword_drop → 'keywords lost ranking'", () => {
    const r = summarizeGroup("keyword_drop", "warning", 12);
    expect(r.title).toBe("12 keywords lost ranking");
  });

  it("vacancy_needs_boost → 'vacancies need a boost'", () => {
    const r = summarizeGroup("vacancy_needs_boost", "info", 3);
    expect(r.title).toBe("3 vacancies need a boost");
  });

  it("cpl_spike → 'cost-per-lead spikes'", () => {
    const r = summarizeGroup("cpl_spike", "critical", 2);
    expect(r.title).toBe("2 cost-per-lead spikes");
  });

  it("wasted_ad_spend → 'ad spend leaks'", () => {
    const r = summarizeGroup("wasted_ad_spend", "warning", 7);
    expect(r.title).toBe("7 ad spend leaks");
  });

  it("renewal_cliff → 'renewal cliffs ahead'", () => {
    const r = summarizeGroup("renewal_cliff", "critical", 1);
    expect(r.title).toBe("1 renewal cliffs ahead");
  });

  it("tour_noshow_spike → 'tour no-show spikes'", () => {
    const r = summarizeGroup("tour_noshow_spike", "warning", 5);
    expect(r.title).toBe("5 tour no-show spikes");
  });

  it("chatbot_silence → 'chatbot silences'", () => {
    const r = summarizeGroup("chatbot_silence", "info", 2);
    expect(r.title).toBe("2 chatbot silences");
  });

  // ── Future-proof fallback ────────────────────────────────────────────────

  it("unknown kind humanizes the kind string in the title", () => {
    const r = summarizeGroup("brand_new_signal", "info", 4);
    // Should split underscores → "brand new signal" so the operator sees
    // a readable line instead of a snake-case enum value.
    expect(r.title).toBe("4 brand new signal alerts");
    expect(r.body).toBe("Open to see the full list.");
  });

  it("unknown single-word kind still produces a coherent line", () => {
    const r = summarizeGroup("anomaly", "info", 1);
    expect(r.title).toBe("1 anomaly alerts");
  });

  // ── Shape invariants ─────────────────────────────────────────────────────

  it("every result has a non-empty title and body", () => {
    const kinds = [
      "portfolio_outlier",
      "pipeline_stall",
      "negative_review",
      "hot_visitor",
      "keyword_drop",
      "vacancy_needs_boost",
      "cpl_spike",
      "wasted_ad_spend",
      "renewal_cliff",
      "tour_noshow_spike",
      "chatbot_silence",
      "future_kind_xyz",
    ];
    for (const kind of kinds) {
      for (const sev of ["info", "warning", "critical"]) {
        const r = summarizeGroup(kind, sev, 3);
        expect(r.title.length, `empty title for ${kind}:${sev}`).toBeGreaterThan(
          5,
        );
        expect(r.body.length, `empty body for ${kind}:${sev}`).toBeGreaterThan(
          10,
        );
      }
    }
  });

  it("count appears verbatim in every title", () => {
    const counts = [1, 2, 5, 17, 100];
    for (const n of counts) {
      const r = summarizeGroup("portfolio_outlier", "info", n);
      expect(r.title).toContain(String(n));
    }
  });
});
