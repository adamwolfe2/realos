import type { LeadStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Lead ↔ Resident proof chain — shared policy module (2026-08-02 SG focus).
//
// The report's core promise is "which captured lead actually signed." The
// only durable evidence is Resident.leadId. This module owns:
//
//   1. The auto-match rules (email → phone → name, unambiguous-only) used
//      by the AppFolio sync's resident phase and
//      scripts/backfill-lead-lease-links.ts.
//   2. The monotonic SIGNED promotion set: a link may promote a lead's
//      status UP to SIGNED, never sideways or down (LOST/UNQUALIFIED stay;
//      SIGNED stays SIGNED).
//
// Matching philosophy (deep-audit decision, kept): false links are worse
// than missing links. A tier only matches when it names EXACTLY ONE lead;
// an ambiguous tier aborts the whole match rather than falling through —
// two leads sharing an email/phone/name is a data-quality signal, not a
// coin flip. No fuzzy matching. (The spec's "unit" corroboration isn't
// possible: Lead rows carry no unit.)
//
// Tier strength differs, so corroboration does too: an email address is a
// globally unique identifier and stands alone. A phone number or a name is
// not, so those tiers additionally require the lead to have been captured
// for the SAME building the resident lives in (or org-wide, propertyId
// null). Without that, one unique "John Smith" in the org links a Property
// A lead to a Property B resident and mints a false proof.
// ---------------------------------------------------------------------------

/** Statuses a resident-link may promote from. Deliberately excludes LOST,
 *  UNQUALIFIED (operator said no — a link must not resurrect silently) and
 *  SIGNED (already there; don't touch convertedAt again). */
export const LEAD_STATUSES_BELOW_SIGNED: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOURED",
  "APPLICATION_SENT",
  "APPLIED",
  "APPROVED",
];

export type LeadMatchCandidate = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Building the lead was captured for; null for org-wide captures. */
  propertyId?: string | null;
};

export type ResidentMatchInput = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Building the resident lives in. Required for the weak tiers to
   *  corroborate; omit and phone/name matching is skipped entirely. */
  propertyId?: string | null;
};

/** Last 10 digits — collapses "+1 (405) 555-0100" / "405.555.0100" /
 *  "14055550100" onto one key. Fewer than 10 digits → no key (too short
 *  to be a full US number; partials would collide). */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Normalized "first last" — lowercased, whitespace collapsed. Requires
 *  BOTH parts, each ≥ 2 chars, so "J." / single-initial rows never match. */
export function nameKey(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const first = (firstName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const last = (lastName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (first.length < 2 || last.length < 2) return null;
  return `${first} ${last}`;
}

export type LeadMatchIndex = {
  /** Original candidates retained for the scored/reviewable matcher. */
  candidates: LeadMatchCandidate[];
  byEmail: Map<string, string[]>;
  byPhone: Map<string, string[]>;
  byName: Map<string, string[]>;
  /** leadId → propertyId. null = org-wide capture, which qualifies on
   *  every building. buildLeadMatchIndex always writes an entry per lead,
   *  so an absent key only happens with a hand-built index and is treated
   *  the same as org-wide. */
  propertyByLeadId: Map<string, string | null>;
};

export function buildLeadMatchIndex(
  leads: LeadMatchCandidate[],
): LeadMatchIndex {
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  const propertyByLeadId = new Map<string, string | null>();
  const push = (m: Map<string, string[]>, k: string | null, id: string) => {
    if (!k) return;
    m.set(k, [...(m.get(k) ?? []), id]);
  };
  for (const l of leads) {
    push(byEmail, l.email ? l.email.trim().toLowerCase() : null, l.id);
    push(byPhone, phoneKey(l.phone), l.id);
    push(byName, nameKey(l.firstName, l.lastName), l.id);
    propertyByLeadId.set(l.id, l.propertyId ?? null);
  }
  return {
    candidates: leads.map((lead) => ({ ...lead })),
    byEmail,
    byPhone,
    byName,
    propertyByLeadId,
  };
}

export type ResidentLeadMatch = {
  leadId: string;
  via: "email" | "phone" | "name";
};

export function matchResidentToLead(
  index: LeadMatchIndex,
  resident: ResidentMatchInput,
): ResidentLeadMatch | null {
  const tiers: Array<{
    via: ResidentLeadMatch["via"];
    key: string | null;
    map: Map<string, string[]>;
    /** Weak tiers must be corroborated by the building — an email address
     *  is a globally unique identifier, a phone number or a name is not.
     *  "John Smith" unique across the org still links a lead captured for
     *  Property A to a resident living at Property B, minting a false
     *  customer-visible proof. Only same-building (or org-wide-capture)
     *  leads qualify on those tiers. */
    requireProperty: boolean;
  }> = [
    {
      via: "email",
      key: resident.email ? resident.email.trim().toLowerCase() : null,
      map: index.byEmail,
      requireProperty: false,
    },
    {
      via: "phone",
      key: phoneKey(resident.phone),
      map: index.byPhone,
      requireProperty: true,
    },
    {
      via: "name",
      key: nameKey(resident.firstName, resident.lastName),
      map: index.byName,
      requireProperty: true,
    },
  ];
  for (const tier of tiers) {
    if (!tier.key) continue;
    if (tier.requireProperty && !resident.propertyId) continue;
    const candidates = tier.map.get(tier.key) ?? [];
    if (candidates.length === 1) {
      const leadId = candidates[0];
      if (tier.requireProperty) {
        const leadProperty = index.propertyByLeadId.get(leadId) ?? null;
        // An org-wide capture (null) can belong to any building, so it
        // still qualifies; a lead bound to a DIFFERENT building does not.
        if (leadProperty !== null && leadProperty !== resident.propertyId) {
          return null;
        }
      }
      return { leadId, via: tier.via };
    }
    if (candidates.length > 1) return null; // ambiguous — abort, never guess
    // 0 candidates → try the next tier
  }
  return null;
}
