import "server-only";

import type { SignalSnapshot } from "./types";

// ----------------------------------------------------------------------------
// pickHeadlineSignal — given the latest snapshot + last 7 days of trailing
// data, choose ONE callout to lead the /portal/insights dashboard. Whichever
// signal moved most (absolute % delta) becomes the headline.
//
// We prefer signals with clear narrative: rep mentions surging, chatbot
// engagement spiking, SEO ranking movement. AEO is included but weighted
// lower so it doesn't drown out leads/mentions which feel "alive."
// ----------------------------------------------------------------------------

export type HeadlineSignal = {
  kind:
    | "reputation"
    | "chatbot"
    | "seo"
    | "aeo"
    | "leads"
    | "traffic"
    | "overall";
  message: string;
  href: string;
  deltaPct: number;
  tone: "positive" | "negative" | "neutral";
};

type SeriesPoint = {
  capturedOn: string;
  overallScore: number | null;
  seo: SignalSnapshot["seo"];
  aeo: SignalSnapshot["aeo"];
  reputation: SignalSnapshot["reputation"];
};

export function pickHeadlineSignal(
  latest: SignalSnapshot | null,
  prev7d: SeriesPoint[],
): HeadlineSignal | null {
  if (!latest) return null;

  // Pick the comparison baseline: the snapshot from ~7 days ago. Fall back
  // to the earliest available point if we don't have a full week of data.
  const baseline = prev7d.length >= 8 ? prev7d[0] : prev7d[0] ?? null;

  const candidates: HeadlineSignal[] = [];

  // ── Reputation: new mentions in the last 24h ────────────────────────────
  const rep = latest.reputation;
  if (rep && rep.totalMentions > 0) {
    const baseRep = (baseline?.reputation?.totalMentions ?? 0) || 0;
    const delta = rep.totalMentions - baseRep;
    if (delta > 0) {
      const positive = Math.round(
        rep.sentimentMix.positive * rep.totalMentions,
      );
      candidates.push({
        kind: "reputation",
        message: `Mentions surged: ${delta} new in the last 24h, ${positive} positive.`,
        href: "/portal/reputation",
        deltaPct: pctChange(baseRep, rep.totalMentions),
        tone: positive >= delta / 2 ? "positive" : "neutral",
      });
    }
    if (rep.newNegative7d >= 3) {
      candidates.push({
        kind: "reputation",
        message: `${rep.newNegative7d} negative mentions surfaced this week — review now.`,
        href: "/portal/reputation",
        deltaPct: rep.newNegative7d * 10,
        tone: "negative",
      });
    }
  }

  // ── Chatbot engagement ───────────────────────────────────────────────────
  const cb = latest.chatbot;
  if (cb && cb.conversations > 0) {
    const baseCount = 0; // baseline snapshot has no chatbot in slim series
    // Use deltas7d when present — it tracks WoW for the same metric.
    const wow = latest.deltas7d?.chatbotConversations ?? null;
    if (wow != null && Math.abs(wow) >= 10) {
      candidates.push({
        kind: "chatbot",
        message: `Chatbot engagement ${wow >= 0 ? "up" : "down"} ${Math.abs(Math.round(wow))}% week-over-week — ${cb.conversations} conversations in 24h.`,
        href: "/portal/chatbot",
        deltaPct: wow,
        tone: wow >= 0 ? "positive" : "negative",
      });
    } else if (cb.conversations >= 5) {
      candidates.push({
        kind: "chatbot",
        message: `${cb.conversations} chatbot conversations in the last 24h.`,
        href: "/portal/chatbot",
        deltaPct: pctChange(baseCount, cb.conversations),
        tone: "neutral",
      });
    }
  }

  // ── SEO ranking movement ────────────────────────────────────────────────
  const seo = latest.seo;
  if (seo && seo.topMovers.length > 0) {
    // Find the keyword with the biggest absolute swing.
    const movers = [...seo.topMovers].sort(
      (a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from),
    );
    const top = movers[0];
    const swing = top.from - top.to; // positive = improved (lower position = better)
    if (Math.abs(swing) >= 2) {
      candidates.push({
        kind: "seo",
        message:
          swing > 0
            ? `Climbed ${swing} positions for "${top.keyword}" — now #${top.to}.`
            : `Dropped ${Math.abs(swing)} positions for "${top.keyword}" — now #${top.to}.`,
        href: "/portal/seo",
        deltaPct: swing * 5,
        tone: swing > 0 ? "positive" : "negative",
      });
    }
  }

  // ── New leads spike ─────────────────────────────────────────────────────
  const leads = latest.leads;
  if (leads && leads.newLeads > 0) {
    const wow = latest.deltas7d?.newLeads ?? null;
    if (wow != null && Math.abs(wow) >= 15) {
      candidates.push({
        kind: "leads",
        message: `New leads ${wow >= 0 ? "up" : "down"} ${Math.abs(Math.round(wow))}% week-over-week — ${leads.newLeads} fresh in 24h.`,
        href: "/portal/leads",
        deltaPct: wow,
        tone: wow >= 0 ? "positive" : "negative",
      });
    }
  }

  // ── AEO citation movement ───────────────────────────────────────────────
  const aeo = latest.aeo;
  if (aeo && baseline?.aeo) {
    const swing = aeo.citationRate - baseline.aeo.citationRate;
    if (Math.abs(swing) >= 0.15) {
      const pct = Math.round(aeo.citationRate * 100);
      candidates.push({
        kind: "aeo",
        message:
          swing > 0
            ? `AI engines now cite you in ${pct}% of target prompts — up from ${Math.round(baseline.aeo.citationRate * 100)}%.`
            : `AI citations slipped to ${pct}% — down from ${Math.round(baseline.aeo.citationRate * 100)}%.`,
        href: "/portal/seo",
        deltaPct: swing * 100,
        tone: swing > 0 ? "positive" : "negative",
      });
    }
  }

  if (candidates.length === 0) {
    // Fall back to an overall score callout so the slot is never empty.
    return {
      kind: "overall",
      message: `Your overall score is ${latest.overallScore}/100 — steady this week.`,
      href: "/portal/insights",
      deltaPct: 0,
      tone: "neutral",
    };
  }

  // Sort by absolute delta magnitude; tie-break favoring negative tones so
  // we surface the thing the operator most needs to react to.
  candidates.sort((a, b) => {
    const mag = Math.abs(b.deltaPct) - Math.abs(a.deltaPct);
    if (mag !== 0) return mag;
    return tonePriority(b.tone) - tonePriority(a.tone);
  });
  return candidates[0];
}

function pctChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

function tonePriority(tone: "positive" | "negative" | "neutral"): number {
  if (tone === "negative") return 2;
  if (tone === "positive") return 1;
  return 0;
}
