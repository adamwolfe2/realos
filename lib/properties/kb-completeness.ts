// ---------------------------------------------------------------------------
// Property Knowledge Base — shared types + completeness scoring (slice S1).
//
// This is the canonical shape of the structured per-property KB. The prompt
// builder, the save action, and the settings form all import from here so the
// floor-plan contract stays in one place. Pure + synchronous so it is fully
// unit-testable without a DB or a React render (vitest node env).
//
// Completeness is WARN-ONLY. It drives a checklist banner that nudges the
// operator to fill gaps; it never blocks publishing or disables the chatbot.
// The whole point is to ground the bot in facts — the more complete the KB,
// the fewer "I'll have the team follow up" deflections the visitor hits.
// ---------------------------------------------------------------------------

/** One canonical floor plan: the type -> size -> price mapping that fixes the
 *  Telegraph hallucination (a "triple" reported as 200 sq ft). Every field but
 *  `type` is optional so partial data is still useful, but a plan only counts
 *  toward completeness when it has BOTH a type label and a square footage. */
export type FloorPlan = {
  /** Human label: "Single", "Double", "Triple", "Studio", "1 Bedroom", … */
  type: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  priceMinCents?: number | null;
  priceMaxCents?: number | null;
  notes?: string | null;
};

/** Structural shape of a PropertyKnowledgeBase row as consumed by the prompt
 *  builder + completeness scorer. Mirrors the Prisma model but keeps `floorPlans`
 *  as a typed array (Prisma stores it as Json). Callers normalize the Json blob
 *  with `parseFloorPlans` before passing it here. */
export type KnowledgeBaseShape = {
  floorPlans?: FloorPlan[] | null;
  communityAmenities?: string[] | null;
  unitAmenities?: string[] | null;
  petPolicy?: string | null;
  parkingInfo?: string | null;
  laundryInfo?: string | null;
  utilitiesIncluded?: string | null;
  smokingPolicy?: string | null;
  leaseTerms?: string | null;
  depositInfo?: string | null;
  currentSpecials?: string | null;
  applicationProcess?: string | null;
  applicationRequirements?: string | null;
  neighborhoodInfo?: string | null;
  transitInfo?: string | null;
  tourInfo?: string | null;
  additionalNotes?: string | null;
};

export type KbCompletenessItem = {
  key: string;
  label: string;
  done: boolean;
  /** Critical items count toward `missingCritical` when absent. */
  critical: boolean;
};

export type KbCompleteness = {
  /** 0–100, rounded. Share of all checklist items that are satisfied. */
  score: number;
  items: KbCompletenessItem[];
  /** Labels of the critical items still missing — surfaced in the warn banner. */
  missingCritical: string[];
};

function hasText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasItems(v: string[] | null | undefined): boolean {
  return Array.isArray(v) && v.some((s) => typeof s === "string" && s.trim().length > 0);
}

/** A floor plan is "complete enough to ground the bot" when it carries a type
 *  label AND a positive square footage — the exact pair whose absence caused
 *  the model to invent type->size mappings. */
export function isUsableFloorPlan(fp: FloorPlan | null | undefined): boolean {
  return (
    !!fp &&
    hasText(fp.type) &&
    typeof fp.squareFeet === "number" &&
    Number.isFinite(fp.squareFeet) &&
    fp.squareFeet > 0
  );
}

/** Defensively coerce an unknown Json blob (Prisma `floorPlans`) into a typed
 *  FloorPlan[]. Drops anything without a usable string `type`. Never throws. */
export function parseFloorPlans(raw: unknown): FloorPlan[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  return raw
    .map((r): FloorPlan | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const type = str(o.type);
      if (!type) return null;
      return {
        type,
        bedrooms: num(o.bedrooms),
        bathrooms: num(o.bathrooms),
        squareFeet: num(o.squareFeet),
        priceMinCents: num(o.priceMinCents),
        priceMaxCents: num(o.priceMaxCents),
        notes: str(o.notes),
      };
    })
    .filter((fp): fp is FloorPlan => fp !== null);
}

// Checklist definition. `critical` items are the facts the bot most often needs
// and most often invents when missing — they gate `missingCritical`. Order is
// the order the banner renders them in.
type CheckDef = {
  key: string;
  label: string;
  critical: boolean;
  done: (kb: KnowledgeBaseShape) => boolean;
};

const CHECKS: CheckDef[] = [
  {
    key: "floorPlans",
    label: "At least one floor plan with a type and square footage",
    critical: true,
    done: (kb) => (kb.floorPlans ?? []).some(isUsableFloorPlan),
  },
  {
    key: "communityAmenities",
    label: "Community amenities",
    critical: true,
    done: (kb) => hasItems(kb.communityAmenities),
  },
  {
    key: "petPolicy",
    label: "Pet policy",
    critical: true,
    done: (kb) => hasText(kb.petPolicy),
  },
  {
    key: "parkingInfo",
    label: "Parking info",
    critical: true,
    done: (kb) => hasText(kb.parkingInfo),
  },
  {
    key: "leaseTerms",
    label: "Lease terms",
    critical: true,
    done: (kb) => hasText(kb.leaseTerms),
  },
  {
    key: "applicationProcess",
    label: "Application process",
    critical: true,
    done: (kb) => hasText(kb.applicationProcess),
  },
  {
    key: "unitAmenities",
    label: "In-unit amenities",
    critical: false,
    done: (kb) => hasItems(kb.unitAmenities),
  },
  {
    key: "utilitiesIncluded",
    label: "Utilities included",
    critical: false,
    done: (kb) => hasText(kb.utilitiesIncluded),
  },
  {
    key: "depositInfo",
    label: "Deposit info",
    critical: false,
    done: (kb) => hasText(kb.depositInfo),
  },
  {
    key: "applicationRequirements",
    label: "Application requirements",
    critical: false,
    done: (kb) => hasText(kb.applicationRequirements),
  },
  {
    key: "neighborhoodInfo",
    label: "Neighborhood info",
    critical: false,
    done: (kb) => hasText(kb.neighborhoodInfo),
  },
  {
    key: "tourInfo",
    label: "Tour info",
    critical: false,
    done: (kb) => hasText(kb.tourInfo),
  },
];

/** Compute the warn-only completeness of a KB. A null/absent KB scores 0 with
 *  every critical item flagged missing. */
export function computeKbCompleteness(
  kb: KnowledgeBaseShape | null | undefined,
): KbCompleteness {
  const safe: KnowledgeBaseShape = kb ?? {};
  const items: KbCompletenessItem[] = CHECKS.map((c) => ({
    key: c.key,
    label: c.label,
    done: c.done(safe),
    critical: c.critical,
  }));
  const doneCount = items.filter((i) => i.done).length;
  const score = items.length === 0 ? 0 : Math.round((doneCount / items.length) * 100);
  const missingCritical = items
    .filter((i) => i.critical && !i.done)
    .map((i) => i.label);
  return { score, items, missingCritical };
}
