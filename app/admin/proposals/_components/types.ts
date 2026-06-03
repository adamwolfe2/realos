// Client-safe types for the composer + subcomponents.

import type {
  ProposalCadence,
  ProposalCatalogKind,
  ProposalLineKind,
  ProposalStatus,
} from "@prisma/client";

/** One delivery phase. Weeks relative to acceptance (week 0 = paid day). */
export type ComposerTimelinePhase = {
  phase: string;
  startWeek: number;
  endWeek: number;
  deliverables: string[];
};

export type ComposerProposal = {
  id: string;
  number: string;
  status: ProposalStatus;
  cadence: ProposalCadence | null;
  trialDays: number;
  currency: string;
  publicMessage: string | null;
  internalNotes: string | null;
  expiresAt: string | null; // ISO string
  discountAmountCents: number;
  discountReason: string | null;
  discountScope: string;
  prospectName: string;
  prospectEmail: string;
  prospectCompany: string | null;
  // Scope of work + delivery timeline (Adam ask 2026-06-03).
  scopeNarrative: string | null;
  timeline: ComposerTimelinePhase[];
};

export type ComposerLine = {
  id: string;
  kind: ProposalLineKind;
  catalogItemId: string | null;
  label: string;
  description: string | null;
  unitPriceCents: number;
  quantity: number;
  recurring: boolean;
  sortOrder: number;
};

export type ComposerCatalogItem = {
  id: string;
  slug: string;
  kind: ProposalCatalogKind;
  label: string;
  description: string;
  defaultPriceCents: number;
  cadence: ProposalCadence | null;
  active: boolean;
  sortOrder: number;
};
