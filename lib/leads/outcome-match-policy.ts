import {
  phoneKey,
  type LeadMatchCandidate,
  type ResidentMatchInput,
} from "@/lib/leads/lead-lease-link";

export type OutcomeMatchMethod =
  | "phone_email"
  | "name_email"
  | "name_phone"
  | "exact_email"
  | "normalized_email"
  | "exact_phone"
  | "normalized_phone"
  | "fuzzy_composite"
  | "name_only"
  | "none";

export type ScoredLeadCandidate = {
  leadId: string;
  confidence: number;
  method: Exclude<OutcomeMatchMethod, "none">;
  reasons: string[];
};

export type OutcomeMatchEvaluation = {
  status: "matched" | "review" | "ambiguous" | "unmatched";
  leadId: string | null;
  confidence: number;
  method: OutcomeMatchMethod;
  candidates: ScoredLeadCandidate[];
  reasons: string[];
};

const AUTO_MATCH_THRESHOLD = 92;
const AUTO_MATCH_MARGIN = 5;

const NICKNAME_CANONICAL: Record<string, string> = {
  alex: "alexander",
  bob: "robert",
  bobby: "robert",
  bill: "william",
  billy: "william",
  beth: "elizabeth",
  betty: "elizabeth",
  chris: "christopher",
  dan: "daniel",
  danny: "daniel",
  dave: "david",
  jim: "james",
  jimmy: "james",
  joe: "joseph",
  kate: "katherine",
  katie: "katherine",
  liz: "elizabeth",
  mike: "michael",
  nick: "nicholas",
  rob: "robert",
  sam: "samuel",
  steve: "steven",
  tom: "thomas",
};

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]?.includes(".")) return null;
  return normalized;
}

function normalizeNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[-\s]+/g, " ")
    .trim();
  return normalized.length >= 2 ? normalized : null;
}

function firstNameAliases(firstName: string): string[] {
  const canonical = NICKNAME_CANONICAL[firstName] ?? firstName;
  const aliases = Object.entries(NICKNAME_CANONICAL)
    .filter(([, value]) => value === canonical)
    .map(([alias]) => alias);
  return [...new Set([firstName, canonical, ...aliases])];
}

export function normalizedNameVariants(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string[] {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last) return [];

  const variants = new Set<string>();
  for (const alias of firstNameAliases(first)) {
    variants.add(`${alias} ${last}`);
  }
  for (const alias of firstNameAliases(last)) {
    variants.add(`${alias} ${first}`);
  }
  return [...variants];
}

function propertyCompatible(
  leadPropertyId: string | null | undefined,
  residentPropertyId: string | null | undefined,
): boolean {
  if (!residentPropertyId) return false;
  return !leadPropertyId || leadPropertyId === residentPropertyId;
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function fuzzyEmailMatch(
  left: string | null,
  right: string | null,
): boolean {
  if (!left || !right || left === right) return false;
  const [leftLocal, leftDomain] = left.split("@");
  const [rightLocal, rightDomain] = right.split("@");
  if (!leftLocal || !rightLocal || leftDomain !== rightDomain) return false;
  return editDistance(leftLocal, rightLocal) <= 2;
}

function scoreCandidate(
  lead: LeadMatchCandidate,
  resident: ResidentMatchInput,
): ScoredLeadCandidate | null {
  const leadEmail = normalizeEmail(lead.email);
  const residentEmail = normalizeEmail(resident.email);
  const email = Boolean(leadEmail && leadEmail === residentEmail);
  const rawEmail = Boolean(
    email && lead.email?.trim() === resident.email?.trim(),
  );

  const compatible = propertyCompatible(lead.propertyId, resident.propertyId);
  const leadPhone = phoneKey(lead.phone);
  const residentPhone = phoneKey(resident.phone);
  const phone = Boolean(compatible && leadPhone && leadPhone === residentPhone);
  const rawPhone = Boolean(
    phone && lead.phone?.trim() === resident.phone?.trim(),
  );

  const name = Boolean(
    compatible &&
      intersects(
        normalizedNameVariants(lead.firstName, lead.lastName),
        normalizedNameVariants(resident.firstName, resident.lastName),
      ),
  );
  const fuzzyEmail = Boolean(
    compatible && name && fuzzyEmailMatch(leadEmail, residentEmail),
  );

  if (email && phone) {
    return {
      leadId: lead.id,
      confidence: 100,
      method: "phone_email",
      reasons: ["Normalized phone and email agree"],
    };
  }
  if (email && name) {
    return {
      leadId: lead.id,
      confidence: 98,
      method: "name_email",
      reasons: ["Email and normalized name agree"],
    };
  }
  if (phone && name) {
    return {
      leadId: lead.id,
      confidence: 97,
      method: "name_phone",
      reasons: ["Phone and normalized name agree on a compatible property"],
    };
  }
  if (email) {
    return {
      leadId: lead.id,
      confidence: rawEmail ? 96 : 95,
      method: rawEmail ? "exact_email" : "normalized_email",
      reasons: [rawEmail ? "Exact email agrees" : "Normalized email agrees"],
    };
  }
  if (phone) {
    return {
      leadId: lead.id,
      confidence: rawPhone ? 94 : 92,
      method: rawPhone ? "exact_phone" : "normalized_phone",
      reasons: [
        rawPhone
          ? "Exact phone agrees on a compatible property"
          : "Normalized phone agrees on a compatible property",
      ],
    };
  }
  if (fuzzyEmail) {
    return {
      leadId: lead.id,
      confidence: 88,
      method: "fuzzy_composite",
      reasons: ["Similar email local-part and normalized name agree"],
    };
  }
  if (name) {
    return {
      leadId: lead.id,
      confidence: 70,
      method: "name_only",
      reasons: ["Normalized name agrees; contact corroboration is missing"],
    };
  }
  return null;
}

export function evaluateResidentLeadMatch(
  leads: LeadMatchCandidate[],
  resident: ResidentMatchInput,
): OutcomeMatchEvaluation {
  const candidates = leads
    .map((lead) => scoreCandidate(lead, resident))
    .filter((row): row is ScoredLeadCandidate => row !== null)
    .sort((left, right) => right.confidence - left.confidence);

  if (candidates.length === 0) {
    return {
      status: "unmatched",
      leadId: null,
      confidence: 0,
      method: "none",
      candidates: [],
      reasons: ["No safe identity candidate"],
    };
  }

  const top = candidates[0];
  const runnerUp = candidates[1];
  const closeCompetition = Boolean(
    runnerUp && top.confidence - runnerUp.confidence < AUTO_MATCH_MARGIN,
  );

  if (closeCompetition) {
    return {
      status: "ambiguous",
      leadId: null,
      confidence: top.confidence,
      method: top.method,
      candidates,
      reasons: ["Multiple candidates are too close to choose safely"],
    };
  }

  if (top.confidence >= AUTO_MATCH_THRESHOLD) {
    return {
      status: "matched",
      leadId: top.leadId,
      confidence: top.confidence,
      method: top.method,
      candidates,
      reasons: top.reasons,
    };
  }

  return {
    status: "review",
    leadId: top.leadId,
    confidence: top.confidence,
    method: top.method,
    candidates,
    reasons: top.reasons,
  };
}
