// Client-safe types for the composer + subcomponents.

import type {
  ProposalCadence,
  ProposalCatalogKind,
  ProposalLineKind,
  ProposalStatus,
} from "@prisma/client";

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
