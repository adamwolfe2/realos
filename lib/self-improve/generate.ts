import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { Prisma, RecommendationStatus, SiteImprovementTarget, SiteImprovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd } from "@/lib/aeo/engines/pricing";
import { getNeedsAttention } from "@/lib/portal/needs-attention";
import { WINDOW } from "@/lib/portal/portfolio-overview";
import { questionKey, unansweredExchanges } from "@/lib/portal/property-cockpit";
import { metricValue } from "@/lib/self-improve/metrics";
import {
  FAIR_HOUSING_NOTE,
  PROPOSAL_SOURCE,
  groundedIn,
  isProtectedTopic,
  isSteering,
  mentionsProtectedClass,
  weekOf,
  type Proposal,
} from "@/lib/self-improve/proposal";

// ---------------------------------------------------------------------------
// Self-improve loop (SG cockpit slice 4). Weekly per property, plus
// "Generate now": turn the Needs-attention signals into proposals on the
// existing Suggested fixes queue. One LLM call per property that has new
// signals (nothing new = no call). Proposals only: nothing is applied here.
//
// Hard rules, enforced in code after the model answers:
//   - A drafted chatbot answer must quote a line that really is in the
//     property's knowledge base; otherwise it becomes "Needs SG's answer".
//   - Fair-housing topics (source of income incl. Section 8, familial
//     status, disability, ...) always need SG's answer; any drafted text
//     that excludes or steers is dropped.
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-5"; // same model as the SEO draft writer
const MAX_QUESTIONS = 8; // per property per run
const MAX_OUTPUT_TOKENS = 2000;
const KB_CHARS = 9000;
const POPUP_MIN_SHOWN = 100; // 28-day shows before conversion means anything
const POPUP_WEAK_RATE = 0.02;
export const PATTERN = "self_improve_answer";
const DAY = 86_400_000;

type Question = { key: string; question: string; count: number; evidence: { conversationId: string; question: string; reply: string }[] };
type PopupSignal = {
  campaignId: string;
  headline: string;
  body: string;
  ctaText: string;
  delaySeconds: number;
  shown: number;
  converted: number;
  reference: { name: string; headline: string; delaySeconds: number; rate: number } | null;
};
type SiteSignal = { id: string; kind: "traffic-no-leads" | "rank-drop"; title: string; detail: string };

const Draft = z.object({
  answers: z
    .array(
      z.object({
        i: z.number().int().describe("index of the question"),
        status: z.enum(["answer", "needs_sg"]),
        answer: z.string().describe("the chatbot answer; empty when needs_sg (max 600 chars)"),
        kbQuote: z.string().describe("exact sentence copied from the knowledge base that the answer relies on; empty when needs_sg (max 300 chars)"),
        askSg: z.string().describe("when needs_sg: the one fact SG must provide (max 200 chars)"),
      }),
    ),
  popup: z
    .object({
      headline: z.string().describe("max 80 chars"),
      body: z.string().describe("max 220 chars"),
      ctaText: z.string().describe("max 30 chars"),
      delaySeconds: z.number().int().describe("seconds on page before it shows, 3-60"),
      why: z.string().describe("max 220 chars"),
    })
    .nullable(),
  site: z.array(z.object({ i: z.number().int(), change: z.string().describe("max 450 chars"), why: z.string().describe("max 220 chars") })),
});
type Draft = z.infer<typeof Draft>;

const SYSTEM = `You help a student-housing and apartment operator improve one property's website chatbot, pop-up and pages.
You propose; a human approves. Write plain, short US English. No emojis, no exclamation points, no marketing fluff.

Chatbot answers:
- Answer ONLY from facts in the KNOWLEDGE BASE. Copy the exact KB sentence you relied on into kbQuote.
- If the KB does not state the fact (policy, fees, negotiation, discounts, dates, anything else), return status "needs_sg" with askSg naming the one fact SG must provide. Never guess or invent policy, prices, discounts or dates.
- State only what the quoted fact says. If the renter asks for an exception, option or change the KB doesn't explicitly cover (unfurnished, lower rent, shorter lease, waived fee), return "needs_sg"; never imply a yes or a no.
- A follow-up that makes no sense without the earlier chat (e.g. "is it written down somewhere?") is "needs_sg" with askSg describing what the renter was after, using the bot's reply for context.
- Questions about source of income (Section 8, vouchers, subsidies), families or children, disability or accommodations, assistance animals, religion, race, national origin, immigration, sex, gender, age, marital status, veterans or criminal history are fair-housing topics: always "needs_sg".

Pop-up (only if a POPUP section is given):
- Propose new headline, body, CTA text and delay seconds that should lift conversion. Use only facts in the KB or the current pop-up. Do not invent offers, discounts or deadlines, and leave prices out (they change daily; the pop-up would go stale).

Website (only if SITE signals are given):
- For each signal, propose one concrete page change (title tag, heading, intro copy, a visible tour/contact CTA, FAQ entry) and why it should help. Text only.

Fair housing (all output): never exclude, discourage or steer anyone by a protected class, and never describe the ideal resident by who they are (only by what the property offers).`;

function prompt(p: { name: string; websiteUrl: string | null; kb: string }, qs: Question[], popup: PopupSignal | null, site: SiteSignal[]): string {
  const parts = [`PROPERTY: ${p.name}${p.websiteUrl ? ` (${p.websiteUrl})` : ""}`, `KNOWLEDGE BASE:\n${p.kb.slice(0, KB_CHARS) || "(empty)"}`];
  if (qs.length) parts.push(`QUESTIONS THE CHATBOT COULD NOT ANSWER:\n${qs.map((q, i) => `${i}. "${q.question.slice(0, 300)}" (asked in ${q.count} chat${q.count === 1 ? "" : "s"}; the bot replied: "${(q.evidence[0]?.reply ?? "").slice(0, 240)}")`).join("\n")}`);
  if (popup) {
    const ref = popup.reference ? `\nBest pop-up in this portfolio: "${popup.reference.headline}" at ${popup.reference.delaySeconds}s converts ${(popup.reference.rate * 100).toFixed(1)}%.` : "";
    parts.push(`POPUP (last 28 days: shown ${popup.shown}, converted ${popup.converted}):\nheadline: ${popup.headline}\nbody: ${popup.body}\ncta: ${popup.ctaText}\ndelay: ${popup.delaySeconds}s${ref}`);
  }
  if (site.length) parts.push(`SITE SIGNALS:\n${site.map((s, i) => `${i}. ${s.title}. ${s.detail}`).join("\n")}`);
  return parts.join("\n\n");
}

async function draft(orgId: string, propertyId: string, text: string): Promise<Draft | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const startedAt = Date.now();
  try {
    const { object, usage } = await generateObject({ model: anthropic(MODEL), schema: Draft, system: SYSTEM, prompt: text, maxOutputTokens: MAX_OUTPUT_TOKENS });
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await logUsage({
      provider: "anthropic",
      endpoint: `${MODEL}/self-improve`,
      status: "SUCCESS",
      costUsd: tokenCostUsd(MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - startedAt,
      orgId,
      propertyId,
      meta: { model: MODEL, inputTokens, outputTokens },
    });
    return object;
  } catch (err) {
    // No draft = every question still becomes a "Needs SG's answer" card.
    console.error(`[self-improve] draft failed for property ${propertyId}:`, err instanceof Error ? err.message : err);
    await logUsage({
      provider: "anthropic",
      endpoint: `${MODEL}/self-improve`,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      orgId,
      propertyId,
      meta: { model: MODEL, error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

export type GenerateResult = { properties: number; llmCalls: number; answers: number; needsAnswer: number; popups: number; site: number };

/**
 * Generate this week's proposals for one workspace. Idempotent: every
 * proposal has a dedupe key, and signals already proposed are skipped
 * before any model call.
 */
/**
 * @param opts.deadline epoch ms: no new property is started after it (the
 *   cron and the button both run inside a 300s function).
 */
export async function generateProposals(orgId: string, opts: { propertyIds?: string[] | null; dryRun?: boolean; deadline?: number } = {}): Promise<GenerateResult & { preview: unknown[]; stoppedEarly: boolean }> {
  const now = new Date();
  const week = weekOf(now);
  const cur = new Date(Math.floor(now.getTime() / DAY) * DAY - (WINDOW - 1) * DAY);
  const props = await prisma.property.findMany({
    where: { orgId, lifecycle: "ACTIVE", ...(opts.propertyIds ? { id: { in: opts.propertyIds } } : {}) },
    select: { id: true, name: true, websiteUrl: true, chatbotConfig: { select: { chatbotKnowledgeBase: true } } },
    take: 200,
  });
  const result = { properties: 0, llmCalls: 0, answers: 0, needsAnswer: 0, popups: 0, site: 0, preview: [] as unknown[], stoppedEarly: false };
  if (!props.length) return result;
  const ids = props.map((p) => p.id);

  const [convs, campaigns, events, attention, existingKb, existingSite, orgKb] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where: { orgId, propertyId: { in: ids }, createdAt: { gte: cur } },
      select: { id: true, propertyId: true, messages: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.popupCampaign.findMany({
      where: { orgId, status: "ACTIVE", propertyId: { in: ids } },
      select: { id: true, name: true, propertyId: true, headline: true, body: true, ctaText: true, trigger: true, triggerThreshold: true },
    }),
    prisma.popupEvent.groupBy({ by: ["campaignId", "type"], where: { orgId, occurredAt: { gte: cur }, type: { in: ["SHOWN", "CONVERTED"] } }, _count: { _all: true } }),
    getNeedsAttention(orgId, ids, null, false),
    prisma.chatbotKnowledgeSuggestion.findMany({ where: { orgId, dedupeKey: { startsWith: "si:" } }, select: { dedupeKey: true } }),
    prisma.siteImprovementRecommendation.findMany({ where: { orgId, dedupeKey: { startsWith: "si:" } }, select: { dedupeKey: true, status: true } }),
    prisma.tenantSiteConfig.findUnique({ where: { orgId }, select: { chatbotKnowledgeBase: true } }),
  ]);
  const taken = new Set(existingKb.map((r) => r.dedupeKey));
  // One open popup/site proposal per signal at a time; a new week may re-propose once the last is handled.
  const openSite = new Set(existingSite.filter((r) => r.status === RecommendationStatus.OPEN).map((r) => r.dedupeKey.split("|")[0]));
  const takenSite = new Set(existingSite.map((r) => r.dedupeKey));

  // Popup performance: the portfolio's best converter is the reference.
  const count = (cid: string, type: string) => events.find((e) => e.campaignId === cid && e.type === type)?._count._all ?? 0;
  const perf = campaigns.map((c) => ({ c, shown: count(c.id, "SHOWN"), converted: count(c.id, "CONVERTED") }));
  const best = perf.filter((x) => x.shown >= POPUP_MIN_SHOWN).sort((a, b) => b.converted / b.shown - a.converted / a.shown)[0] ?? null;
  const delay = (c: { trigger: string; triggerThreshold: number }) => (c.trigger === "TIME_ON_PAGE" ? c.triggerThreshold : 0);

  for (const p of props) {
    const kb = p.chatbotConfig?.chatbotKnowledgeBase ?? orgKb?.chatbotKnowledgeBase ?? "";
    // 1. Questions the bot couldn't answer, grouped, most-asked first.
    const byKey = new Map<string, Question>();
    const pConvs = convs.filter((c) => c.propertyId === p.id);
    for (const c of pConvs) {
      for (const ex of unansweredExchanges(c.messages)) {
        const key = questionKey(ex.question);
        if (!key) continue;
        const q = byKey.get(key) ?? { key, question: ex.question, count: 0, evidence: [] };
        q.count += 1;
        if (q.evidence.length < 2) q.evidence.push({ conversationId: c.id, ...ex });
        byKey.set(key, q);
      }
    }
    const qs = [...byKey.values()].filter((q) => !taken.has(`si:q:${p.id}:${q.key}`.slice(0, 190))).sort((a, b) => b.count - a.count).slice(0, MAX_QUESTIONS);

    // 2. A pop-up that is shown a lot and rarely converts.
    const weak = perf.find((x) => x.c.propertyId === p.id && x.shown >= POPUP_MIN_SHOWN && x.converted / x.shown < POPUP_WEAK_RATE && x.c.id !== best?.c.id);
    const popup: PopupSignal | null =
      weak && !openSite.has(`si:popup:${weak.c.id}`) && !takenSite.has(`si:popup:${weak.c.id}|${week}`)
        ? {
            campaignId: weak.c.id,
            headline: weak.c.headline,
            body: weak.c.body,
            ctaText: weak.c.ctaText,
            delaySeconds: delay(weak.c),
            shown: weak.shown,
            converted: weak.converted,
            reference: best ? { name: best.c.name, headline: best.c.headline, delaySeconds: delay(best.c), rate: best.converted / best.shown } : null,
          }
        : null;

    // 3. Website signals from Needs attention.
    const site: SiteSignal[] = attention
      .filter((a): a is typeof a & { kind: SiteSignal["kind"] } => a.propertyId === p.id && (a.kind === "traffic-no-leads" || a.kind === "rank-drop"))
      .filter((a) => !openSite.has(`si:site:${a.id}`) && !takenSite.has(`si:site:${a.id}|${week}`))
      .map((a) => ({ id: a.id, kind: a.kind, title: a.title, detail: a.detail }));

    if (!qs.length && !popup && !site.length) continue;
    if (opts.deadline && Date.now() > opts.deadline) {
      // ponytail: sequential, one property at a time; the rest wait for the next run.
      result.stoppedEarly = true;
      break;
    }
    result.properties += 1;
    const d = opts.dryRun ? null : await draft(orgId, p.id, prompt({ name: p.name, websiteUrl: p.websiteUrl, kb }, qs, popup, site));
    if (d) result.llmCalls += 1;
    // No draft (model error, no key): write nothing so the next run retries,
    // rather than locking every question in as "Needs SG's answer".
    if (!d && !opts.dryRun) continue;

    const [unanswered, leads] = await Promise.all([
      metricValue("unanswered", { orgId, propertyId: p.id }, cur, now),
      metricValue("leads", { orgId, propertyId: p.id }, cur, now),
    ]);
    const base = { v: 1 as const, source: PROPOSAL_SOURCE as typeof PROPOSAL_SOURCE, week };

    const kbRows: Prisma.ChatbotKnowledgeSuggestionCreateManyInput[] = qs.map((q, i) => {
      const a = d?.answers.find((x) => x.i === i);
      const protectedTopic = isProtectedTopic(q.question);
      const drafted = a?.status === "answer" && !protectedTopic && a.answer.trim() && groundedIn(kb, a.kbQuote) && !isSteering(a.answer);
      const proposal: Proposal = {
        ...base,
        why: `Asked in ${q.count} chat${q.count === 1 ? "" : "s"} in the last ${WINDOW} days; the bot said it didn't know.`,
        evidence: q.evidence,
        metric: { key: "unanswered", value: unanswered.value, of: unanswered.of, days: WINDOW },
        question: q.question.slice(0, 300),
        ...(drafted
          ? { grounding: a!.kbQuote }
          : { needsAnswer: true, askSg: (a?.status === "needs_sg" && a.askSg.trim().slice(0, 240)) || "The knowledge base doesn't say. What should the chatbot tell renters?" }),
        ...(protectedTopic ? { fairHousing: FAIR_HOUSING_NOTE } : {}),
      };
      if (drafted) result.answers += 1;
      else result.needsAnswer += 1;
      return {
        orgId,
        propertyId: p.id,
        patternType: PATTERN,
        affectedCount: q.count,
        suggestedText: drafted ? a!.answer.trim().slice(0, 1200) : "",
        sourceCaseIds: [],
        dedupeKey: `si:q:${p.id}:${q.key}`.slice(0, 190),
        proposal: proposal as Prisma.InputJsonValue,
      };
    });

    const siteRows: Prisma.SiteImprovementRecommendationCreateManyInput[] = [];
    const pp = d?.popup;
    if (popup && pp && ![pp.headline, pp.body, pp.ctaText].some(mentionsProtectedClass)) {
      const proposal: Proposal = {
        ...base,
        why: `Shown ${popup.shown} times in ${WINDOW} days, ${popup.converted} sign-ups (${((popup.converted / popup.shown) * 100).toFixed(1)}%)${popup.reference ? `; ${popup.reference.name} converts ${(popup.reference.rate * 100).toFixed(1)}%` : ""}.`,
        evidence: [],
        metric: { key: "popup_conversion", value: popup.converted, of: popup.shown, days: WINDOW },
        popup: {
          campaignId: popup.campaignId,
          current: { headline: popup.headline, body: popup.body, ctaText: popup.ctaText, delaySeconds: popup.delaySeconds },
          proposed: { headline: pp.headline.trim().slice(0, 80), body: pp.body.trim().slice(0, 300), ctaText: pp.ctaText.trim().slice(0, 30), delaySeconds: Math.min(60, Math.max(3, pp.delaySeconds)) },
        },
      };
      siteRows.push({
        orgId,
        propertyId: p.id,
        recommendationType: SiteImprovementType.POPUP_COPY,
        targetSurface: SiteImprovementTarget.POPUP,
        suggestedTitle: "Pop-up copy and timing",
        suggestedBody: pp.why.trim(),
        dedupeKey: `si:popup:${popup.campaignId}|${week}`,
        proposal: proposal as Prisma.InputJsonValue,
      });
      result.popups += 1;
    }
    for (const s of (d?.site ?? []).slice(0, 4)) {
      const sig = site[s.i];
      if (!sig || mentionsProtectedClass(s.change)) continue;
      const proposal: Proposal = {
        ...base,
        why: `${sig.title}. ${sig.detail}`,
        evidence: [],
        metric: { key: "leads", value: leads.value, of: null, days: WINDOW },
        ...(p.websiteUrl ? { link: p.websiteUrl } : {}),
      };
      siteRows.push({
        orgId,
        propertyId: p.id,
        recommendationType: sig.kind === "rank-drop" ? SiteImprovementType.SEO_COPY : SiteImprovementType.TOUR_CTA,
        targetSurface: SiteImprovementTarget.TENANT_SITE,
        suggestedTitle: sig.kind === "rank-drop" ? "Win back the Google position" : "Turn search visits into leads",
        suggestedBody: `${s.change.trim()}\n\nWhy: ${s.why.trim()}`,
        dedupeKey: `si:site:${sig.id}|${week}`,
        proposal: proposal as Prisma.InputJsonValue,
      });
      result.site += 1;
    }

    if (opts.dryRun) {
      result.preview.push({ property: p.name, questions: qs.map((q) => `${q.question} (${q.count})`), popup: popup?.headline ?? null, site: site.map((s) => s.title) });
      continue;
    }
    await prisma.$transaction([
      prisma.chatbotKnowledgeSuggestion.createMany({ data: kbRows, skipDuplicates: true }),
      prisma.siteImprovementRecommendation.createMany({ data: siteRows, skipDuplicates: true }),
    ]);
  }
  return result;
}
