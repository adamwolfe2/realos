// ---------------------------------------------------------------------------
// SG Real Estate / Telegraph Commons case study: every number the public
// page (/case-study) and docs/case-studies/sg-real-estate.txt show.
//
// Nothing here is queried at runtime. Each value is frozen from the
// production database and re-checked by the read-only script
// scripts/case-study/verify-sg-numbers.ts, which recomputes it with the
// same code the client report uses (lib/reports/generate.ts) and prints
// PASS/FAIL. Change a value here only after that script agrees.
//
// Window = the window of the client report SG Real Estate was sent
// (ClientReport cmsr3os9p0000s23lq85l7ypm, regenerated 2026-09-15). Org-wide
// scope, which resolves to the one ACTIVE property, Telegraph Commons
// (cmo402dzi0003c93lq9i6xz6h). Full definitions and SQL:
// .claude/specs/2026-09-28-case-study-numbers.md (uncommitted spec).
// ---------------------------------------------------------------------------

/**
 * Naming the customer publicly needs Adam's and SG Real Estate's OK. While
 * false the page is noindex, left out of the sitemap, and left out of the
 * nav. Flip to true to publish all three at once.
 */
export const CASE_STUDY_PUBLIC = false;

export const CASE_STUDY_PATH = "/case-study";

export const SG_CASE_STUDY = {
  /** Date the numbers below were last re-verified against production. */
  asOf: "2026-09-25",
  orgId: "cmo402dwz0002c93lf3okkgi0",
  propertyId: "cmo402dzi0003c93lq9i6xz6h",
  customer: "SG Real Estate",
  property: "Telegraph Commons",
  market: "Berkeley student housing",
  period: {
    start: "2026-03-21T00:57:20.176Z",
    end: "2026-09-15T18:45:42.769Z",
    label: "March 21 to September 15, 2026",
  },

  /**
   * The report window opens before LeaseStack was live at the property. The
   * org was created 2026-04-18. These are the first rows at the property,
   * as UTC calendar dates, so the page can say when tracking actually began.
   */
  firstRecords: {
    /** First ChatbotConversation.createdAt (report conversation scope). */
    conversation: "2026-04-20",
    /** First Lead.createdAt at the ACTIVE property, any source. */
    lead: "2026-05-07",
    /** First Lead.createdAt with sourceDetail "AppFolio application". */
    appfolioApplication: "2026-06-19",
  },

  /**
   * Lead ROWS in the window, not people. Report KPI "leads": Lead.createdAt
   * in window, property lifecycle ACTIVE. Sources are only the chatbot (100)
   * and AppFolio applications (91). As of 2026-09-25.
   */
  leads: 191,

  /**
   * Lead rows whose source is CHATBOT, same window and scope. Report field
   * chatbotStats.leadsFromChat. As of 2026-09-25.
   */
  chatbotLeads: 100,

  /**
   * Distinct lower-cased emails across those chatbot lead rows. Rows are not
   * people: some renters left details more than once. As of 2026-09-25.
   */
  chatbotLeadEmails: 79,

  /**
   * Chatbot lead rows whose email is the property's own inbox
   * (@telegraphcommons.com). As of 2026-09-25.
   */
  chatbotLeadsFromPropertyInbox: 1,

  /**
   * Chatbot sessions started in the window (ACTIVE property or org-level
   * rows). Report field chatbotStats.conversations. As of 2026-09-25.
   */
  chatbotConversations: 238,

  /**
   * Sessions with status LEAD_CAPTURED (contact details left). Report field
   * chatbotStatsExtended.capturedConversations. As of 2026-09-25.
   */
  chatbotCapturedConversations: 110,

  /**
   * Captured sessions with messageCount <= 1: the details came through the
   * pre-chat contact form, not a conversation. As of 2026-09-25.
   */
  chatbotPreChatCaptures: 57,

  /** Sessions with messageCount > 1 (an actual conversation). As of 2026-09-25. */
  chatbotConversationsWithMessages: 181,

  /** Of those, sessions with status LEAD_CAPTURED. As of 2026-09-25. */
  chatbotCapturedWithMessages: 53,

  /**
   * Leads marked signed and matched to an AppFolio resident. Report field
   * tracedSignedLeads: Lead at the ACTIVE property with >= 1 Resident link
   * (automatic AppFolio sync match; 0 manual links), status SIGNED,
   * convertedAt in window, any source. This is lead ROWS with a resident
   * match, not verified leases: only 5 have a Lease row, and there is no
   * check on the resident's building. As of 2026-09-25.
   */
  tracedSignedLeases: 46,

  /**
   * Of tracedSignedLeases, leads with at least one linked Resident at the
   * ACTIVE property (Telegraph Commons). The other 2 link only to residents
   * at EXCLUDED buildings in the same AppFolio account. As of 2026-09-25.
   */
  tracedAtProperty: 44,

  /**
   * Of tracedSignedLeases, leads whose source is CHATBOT. All 8 have
   * sourceDetail "chatbot:pre_chat": the lead row was created by the
   * chatbot's pre-chat contact form. That is where the record came from, not
   * what caused the lease. As of 2026-09-25.
   */
  chatbotTracedSignedLeases: 8,
} as const;

export type SgCaseStudy = typeof SG_CASE_STUDY;

/** Whole-number percentage, the same rounding the client report uses. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
