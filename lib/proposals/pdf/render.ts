import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React from "react";
import ProposalPdfDocument from "./document";
import type { ProposalTotalsCents, ProposalWithLines } from "../types";

// ---------------------------------------------------------------------------
// Server-side proposal PDF render. Wraps @react-pdf's `renderToBuffer` so
// callers never have to think about JSX in API route files. Runs inside a
// Vercel Node serverless function (NOT edge — react-pdf uses Node-only
// dependencies). Cold-start cost is bounded because we don't register any
// custom fonts; we ride on the built-in Helvetica family.
// ---------------------------------------------------------------------------

export type AgencyContext = {
  name: string;
  email: string;
  websiteUrl: string;
};

const DEFAULT_AGENCY: AgencyContext = {
  name: "LeaseStack",
  email: "adam@leasestack.co",
  websiteUrl: "www.leasestack.co",
};

/** Read agency context from env with sensible LeaseStack defaults. The PDF
 *  render path runs in a serverless context where env vars are the only
 *  source of truth — no DB lookup, no cross-tenant agency override yet. */
export function resolveAgencyContext(
  override?: AgencyContext,
): AgencyContext {
  if (override) return override;
  const email = process.env.LEASESTACK_CONTACT_EMAIL?.trim();
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  // Strip protocol for display — `https://www.leasestack.co` is ugly in the
  // footer line; we want `www.leasestack.co`. Keep the URL parsing defensive
  // so a malformed env var (no scheme) still produces a readable string.
  const websiteUrl = rawUrl
    ? rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
    : DEFAULT_AGENCY.websiteUrl;
  return {
    name: DEFAULT_AGENCY.name,
    email: email || DEFAULT_AGENCY.email,
    websiteUrl,
  };
}

/** Render the proposal PDF to a Node Buffer. Throws on render failure;
 *  callers should map that to a 500 with a generic message — internal
 *  render errors must not leak Stripe IDs or prospect details to the
 *  caller. */
export async function renderProposalPdf(args: {
  proposal: ProposalWithLines;
  totals: ProposalTotalsCents;
  agency?: AgencyContext;
}): Promise<Buffer> {
  const agency = resolveAgencyContext(args.agency);
  const { proposal, totals } = args;

  // Project the Prisma row into the PDF prop shape. ProposalLineKind has
  // exactly four members (TIER, ADDON, CUSTOM, SETUP) — discounts live on
  // the Proposal header, not as line items, so no filter needed.
  const lineItems = [...proposal.lineItems]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      label: l.label,
      description: l.description,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      recurring: l.recurring,
      kind: l.kind,
    }));

  const element = React.createElement(ProposalPdfDocument, {
    proposal: {
      number: proposal.number,
      prospectName: proposal.prospectName,
      prospectCompany: proposal.prospectCompany,
      prospectEmail: proposal.prospectEmail,
      cadence: proposal.cadence,
      trialDays: proposal.trialDays,
      currency: proposal.currency,
      expiresAt: proposal.expiresAt,
      publicMessage: proposal.publicMessage,
      discountAmountCents: proposal.discountAmountCents,
      discountReason: proposal.discountReason,
      sentAt: proposal.sentAt,
      createdAt: proposal.createdAt,
    },
    lineItems,
    totals: {
      recurringTotal: totals.recurringTotal,
      oneTimeTotal: totals.oneTimeTotal,
      firstInvoiceTotal: totals.firstInvoiceTotal,
      hasTrial: totals.hasTrial,
      recurringDiscount: totals.recurringDiscount,
      oneTimeDiscount: totals.oneTimeDiscount,
    },
    agency,
  });

  // `renderToBuffer` types its element parameter as `ReactElement<DocumentProps>`.
  // Our component's prop type doesn't extend `DocumentProps` (it's the inner
  // app prop shape, not the @react-pdf `<Document>` prop shape), so we cast
  // through `unknown` at the element boundary. The returned Buffer type is
  // similarly cast — the lib types are imprecise in Node-runtime usage.
  const buffer = (await renderToBuffer(
    element as unknown as React.ReactElement<DocumentProps>,
  )) as unknown as Buffer;
  return buffer;
}
