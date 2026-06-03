// ---------------------------------------------------------------------------
// Proposal PDF — shared types.
//
// Extracted from document.tsx so the table primitives and the doc itself
// can both type against the same prop shape without circular imports.
// ---------------------------------------------------------------------------

export type ProposalPdfTimelinePhase = {
  phase: string;
  startWeek: number;
  endWeek: number;
  deliverables: string[];
};

export type ProposalPdfDocumentProps = {
  proposal: {
    number: string;
    prospectName: string;
    prospectCompany: string | null;
    prospectEmail: string;
    cadence: "MONTHLY" | "ANNUAL" | null;
    trialDays: number;
    currency: string;
    expiresAt: Date | null;
    publicMessage: string | null;
    discountAmountCents: number;
    discountReason: string | null;
    sentAt: Date | null;
    createdAt: Date;
    /// Optional scope-of-work narrative. Renders as a paragraph block
    /// between the title and the line items. Markdown bold/italic
    /// degrades gracefully (treated as plain text in PDF).
    scopeNarrative: string | null;
    /// Optional structured delivery timeline. Weeks are relative to
    /// acceptance (week 0 = signed-and-paid day). Empty/null → section
    /// is skipped entirely.
    timeline: ProposalPdfTimelinePhase[] | null;
  };
  lineItems: Array<{
    label: string;
    description: string | null;
    unitPriceCents: number;
    quantity: number;
    recurring: boolean;
    kind: "TIER" | "ADDON" | "CUSTOM" | "SETUP";
  }>;
  totals: {
    recurringTotal: number;
    oneTimeTotal: number;
    firstInvoiceTotal: number;
    hasTrial: boolean;
    recurringDiscount: number;
    oneTimeDiscount: number;
  };
  agency: {
    name: string;
    email: string;
    websiteUrl: string;
  };
};
