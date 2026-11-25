import { z } from "zod";

// ---------------------------------------------------------------------------
// Self-improve loop (SG cockpit slice 4): the proposal payload stored on the
// existing suggestion rows (ChatbotKnowledgeSuggestion.proposal for chatbot
// answers, SiteImprovementRecommendation.proposal for pop-up and website
// changes). Pure helpers only: parsing, fair-housing guards, KB block text,
// before/after maths. No I/O here so it is all unit-tested.
// ---------------------------------------------------------------------------

export const PROPOSAL_SOURCE = "self-improve";

export const MetricKey = z.enum(["unanswered", "popup_conversion", "leads"]);
export type MetricKey = z.infer<typeof MetricKey>;

const Evidence = z.object({
  conversationId: z.string().nullable(),
  question: z.string(),
  reply: z.string().nullable(),
});

export const Proposal = z.object({
  v: z.literal(1),
  source: z.literal(PROPOSAL_SOURCE),
  /** Monday (UTC, yyyy-mm-dd) of the week the proposal was generated. */
  week: z.string(),
  /** One line: why this exists ("Asked in 3 chats since Oct 28"). */
  why: z.string(),
  evidence: z.array(Evidence).default([]),
  metric: z.object({
    key: MetricKey,
    /** Value when proposed, over `days` days (e.g. 4 of 39 chats). */
    value: z.number(),
    of: z.number().nullable(),
    days: z.number(),
  }),
  /** Chatbot answers: the renter question this answers. */
  question: z.string().optional(),
  /** Facts we don't have: SG must write the answer before it can apply. */
  needsAnswer: z.boolean().optional(),
  /** What to ask SG when needsAnswer. */
  askSg: z.string().optional(),
  /** Fair-housing note shown on the card (protected topic). */
  fairHousing: z.string().optional(),
  /** The knowledge-base line the drafted answer is grounded in. */
  grounding: z.string().optional(),
  /** Pop-up tweak: the campaign, its current copy and the proposed copy. */
  popup: z
    .object({
      campaignId: z.string(),
      current: z.object({ headline: z.string(), body: z.string(), ctaText: z.string(), delaySeconds: z.number() }),
      proposed: z.object({ headline: z.string(), body: z.string(), ctaText: z.string(), delaySeconds: z.number() }),
    })
    .optional(),
  /** Website change (proposal only): the page it applies to. */
  link: z.string().optional(),
});
export type Proposal = z.infer<typeof Proposal>;

/** Null for rows the learning loop wrote (no proposal) or a malformed payload. */
export function readProposal(raw: unknown): Proposal | null {
  if (raw == null) return null;
  const parsed = Proposal.safeParse(raw);
  if (!parsed.success) {
    console.error("[self-improve] unreadable proposal payload:", parsed.error.issues[0]);
    return null;
  }
  return parsed.data;
}

export const METRIC_LABEL: Record<MetricKey, { label: string; lowerIsBetter: boolean }> = {
  unanswered: { label: "Chats the bot couldn't answer", lowerIsBetter: true },
  popup_conversion: { label: "Pop-up conversion", lowerIsBetter: false },
  leads: { label: "Website leads", lowerIsBetter: false },
};

export function formatMetric(key: MetricKey, value: number, of: number | null): string {
  if (key === "popup_conversion") return of ? `${((value / of) * 100).toFixed(1)}% (${value} of ${of} shown)` : `${value} conversions`;
  if (key === "unanswered") return of ? `${value} of ${of} chats` : `${value} chats`;
  return `${value}`;
}

// --- Fair housing ----------------------------------------------------------

// Questions on these topics touch protected classes (federal Fair Housing
// Act and California FEHA, incl. source of income such as Section 8). The
// answer is a policy only SG can state, so these always need SG's answer.
const PROTECTED_TOPIC =
  /section\s*8|voucher|housing choice|source of income|subsidi[sz]|\bssi\b|\bssdi\b|welfare|disab|wheelchair|accessib|service (animal|dog)|emotional support|\besa\b|famil(y|ies)|\bkids?\b|child|pregnan|religio|church|mosque|synagogue|\brace\b|ethnic|national origin|immigra|citizen|\bssn\b|social security|gender|transgender|sexual orientation|\blgbt|marital|married|\bage\b|senior|elderly|veteran|military|criminal|felon|arrest/i;

export function isProtectedTopic(question: string): boolean {
  return PROTECTED_TOPIC.test(question);
}

export const FAIR_HOUSING_NOTE =
  "Fair-housing topic. Write SG's actual policy; it must apply to every applicant equally.";

// Wording that would exclude or steer (never proposed, never applied).
const STEERING =
  /\b(no|not|don'?t|do not|cannot|can'?t|won'?t)\b[^.]{0,40}\b(section\s*8|vouchers?|subsidi\w*|assistance|children|kids|famil\w+|disab\w+|immigrants?)\b|\badults? only\b|\bno (kids|children)\b|\b(perfect|ideal|best) for (young|single|mature|christian)\b|\b(young|single) professionals only\b|\bmature (tenants|adults|residents)\b|\benglish[- ]speaking\b|\bchristian\b|\bchurch[- ]going\b/i;

/** True when text excludes or steers by a protected class. */
export function isSteering(text: string): boolean {
  return STEERING.test(text);
}

/** Pop-up and website copy must not mention protected classes at all. */
export function mentionsProtectedClass(text: string): boolean {
  return PROTECTED_TOPIC.test(text) || STEERING.test(text);
}

/** The drafted answer's quoted fact must really be in the knowledge base. */
export function groundedIn(kb: string, quote: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%]+/g, " ").trim();
  const q = norm(quote);
  return q.length >= 12 && norm(kb).includes(q);
}

// --- Knowledge base text ---------------------------------------------------

/** Approved answers start with this line; the KB refresh script keeps them. */
export const APPROVED_PREFIX = "Approved answer";

export function answerBlock(question: string, answer: string): string {
  return `${APPROVED_PREFIX} (renters asked: "${question.replace(/\s+/g, " ").trim().slice(0, 200)}"):\n${answer.trim().replace(/\n{2,}/g, "\n")}`;
}

/** Approved blocks in an existing KB (learning-loop and self-improve ones). */
export function approvedBlocks(kb: string | null | undefined): string[] {
  if (!kb) return [];
  return kb.split(/\n{2,}/).filter((b) => b.startsWith(APPROVED_PREFIX) || b.startsWith("Approved chatbot learning:"));
}

// --- Weeks -----------------------------------------------------------------

/** Monday (UTC) of the week containing `d`, yyyy-mm-dd. */
export function weekOf(d: Date): string {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Mon = 0
  return new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
}

// --- Before / after --------------------------------------------------------

const DAY = 86_400_000;
export const MEASURE_MIN_DAYS = 7;
export const MEASURE_MAX_DAYS = 28;

/** Equal windows either side of the approval: null until MIN days live. */
export function measureWindow(appliedAt: Date, now: Date) {
  const daysLive = Math.floor((now.getTime() - appliedAt.getTime()) / DAY);
  if (daysLive < MEASURE_MIN_DAYS) return { daysLive, window: null };
  const days = Math.min(daysLive, MEASURE_MAX_DAYS);
  return {
    daysLive,
    window: { days, start: new Date(appliedAt.getTime() - days * DAY), appliedAt, end: new Date(appliedAt.getTime() + days * DAY) },
  };
}

export type Measured = { key: MetricKey; days: number; before: { value: number; of: number | null }; after: { value: number; of: number | null } };

/** Change as a signed rate delta (percentage points of the rate, or count %). */
export function change(m: Measured): { pct: number | null; better: boolean | null } {
  const rate = (x: { value: number; of: number | null }) => (x.of === null ? x.value : x.of ? x.value / x.of : null);
  const b = rate(m.before);
  const a = rate(m.after);
  if (b === null || a === null) return { pct: null, better: null };
  if (b === 0) return { pct: null, better: a === 0 ? null : !METRIC_LABEL[m.key].lowerIsBetter };
  const pct = Math.round(((a - b) / b) * 100);
  if (pct === 0) return { pct: 0, better: null };
  return { pct, better: METRIC_LABEL[m.key].lowerIsBetter ? pct < 0 : pct > 0 };
}
