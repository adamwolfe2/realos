import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import {
  formatMoney,
  formatDate,
  cadenceSuffix,
  cadenceWord,
} from "./format";
import { LineSection } from "./table";
import { buildTermsCopy } from "./terms";
import type { ProposalPdfDocumentProps } from "./types";

// ---------------------------------------------------------------------------
// Proposal PDF document.
//
// Design brief: extremely professional, simple, concise, lightly branded with
// LeaseStack, otherwise super corporate / minimal. No images, no zebra
// stripes, no emoji. Single accent color used sparingly. Helvetica family
// (the @react-pdf built-in) so we don't pay the font-registration cost or
// risk a missing-glyph error at render time on a serverless cold start.
//
// Module split (W2 SHOULDs cleanup):
//   - styles.ts   palette + StyleSheet (presentation tokens)
//   - format.ts   formatMoney / formatDate / cadence helpers
//   - table.tsx   TableHeader / LineRow / LineSection primitives
//   - terms.ts    buildTermsCopy
//   - types.ts    ProposalPdfDocumentProps shared shape
//   - document.tsx (this file) — composition only
// ---------------------------------------------------------------------------

export type { ProposalPdfDocumentProps } from "./types";

export default function ProposalPdfDocument(
  props: ProposalPdfDocumentProps,
): React.ReactElement {
  const { proposal, lineItems, totals, agency } = props;
  const currency = proposal.currency || "usd";

  // Split lines into recurring vs one-time buckets for grouped display.
  const recurringLines = lineItems.filter((l) => l.recurring);
  const oneTimeLines = lineItems.filter((l) => !l.recurring);

  const totalDiscount =
    (totals.recurringDiscount || 0) + (totals.oneTimeDiscount || 0);

  const issuedOn = formatDate(proposal.sentAt ?? proposal.createdAt);
  const validUntil = formatDate(proposal.expiresAt);

  // First charge messaging. With a trial, the recurring portion doesn't bill
  // until trial end; the operator wants the prospect to see clearly when
  // money actually moves.
  const firstChargeDate = (() => {
    if (!totals.hasTrial) return null;
    const base = proposal.sentAt ?? new Date();
    const ms = base.getTime() + proposal.trialDays * 24 * 60 * 60 * 1000;
    return formatDate(new Date(ms));
  })();

  const preparedFor =
    proposal.prospectCompany?.trim() || proposal.prospectName;
  const preparedForSub =
    proposal.prospectCompany?.trim() && proposal.prospectName
      ? `${proposal.prospectName} · ${proposal.prospectEmail}`
      : proposal.prospectEmail;

  return (
    <Document
      title={`Proposal ${proposal.number}`}
      author={agency.name}
      creator={agency.name}
      producer={agency.name}
      subject={`Proposal for ${preparedFor}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.wordmark}>{agency.name.toUpperCase()}</Text>
          <Text style={styles.headerMetaRow}>{proposal.number}</Text>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>
            PROPOSAL · {proposal.number}
            {issuedOn ? ` · ${issuedOn}` : ""}
          </Text>
          <Text style={styles.preparedFor}>Prepared for {preparedFor}</Text>
          <Text style={styles.preparedForSub}>{preparedForSub}</Text>
        </View>

        {/* Public message */}
        {proposal.publicMessage ? (
          <Text style={styles.publicMessage}>{proposal.publicMessage}</Text>
        ) : null}

        {/* Line items */}
        <LineSection
          label="RECURRING"
          lines={recurringLines}
          currency={currency}
          cadence={proposal.cadence}
        />
        <LineSection
          label="ONE-TIME"
          lines={oneTimeLines}
          currency={currency}
          cadence={proposal.cadence}
        />

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsCol}>
            {totals.recurringTotal > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Recurring {cadenceWord(proposal.cadence)}
                </Text>
                <Text style={styles.totalsValue}>
                  {formatMoney(totals.recurringTotal, currency)}
                  {cadenceSuffix(proposal.cadence)}
                </Text>
              </View>
            ) : null}

            {totals.oneTimeTotal > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>One-time</Text>
                <Text style={styles.totalsValue}>
                  {formatMoney(totals.oneTimeTotal, currency)}
                </Text>
              </View>
            ) : null}

            {totalDiscount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount
                  {proposal.discountReason
                    ? ` · ${proposal.discountReason}`
                    : ""}
                </Text>
                <Text style={styles.totalsDiscountValue}>
                  -{formatMoney(totalDiscount, currency)}
                </Text>
              </View>
            ) : null}

            {totals.hasTrial ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  {proposal.trialDays}-day free trial
                </Text>
                <Text style={styles.totalsValue}>
                  {firstChargeDate
                    ? `First charge ${firstChargeDate}`
                    : "Trial included"}
                </Text>
              </View>
            ) : null}

            <View style={[styles.totalsRow, styles.totalsRowDivider]}>
              <Text style={styles.totalsDueLabel}>Due today</Text>
              <Text style={styles.totalsDueValue}>
                {formatMoney(totals.firstInvoiceTotal, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.terms} wrap={false}>
          <Text style={styles.termsLabel}>BILLING TERMS</Text>
          <Text style={styles.termsText}>
            {buildTermsCopy({
              cadence: proposal.cadence,
              hasTrial: totals.hasTrial,
              trialDays: proposal.trialDays,
              firstChargeDate,
              hasRecurring: totals.recurringTotal > 0,
              hasOneTime: totals.oneTimeTotal > 0,
              validUntil,
              currency,
            })}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated {formatDate(new Date())} · {agency.name} ·{" "}
            {agency.websiteUrl}
          </Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
