import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Proposal PDF document.
//
// Design brief: extremely professional, simple, concise, lightly branded with
// LeaseStack, otherwise super corporate / minimal. No images, no zebra
// stripes, no emoji. Single accent color used sparingly. Helvetica family
// (the @react-pdf built-in) so we don't pay the font-registration cost or
// risk a missing-glyph error at render time on a serverless cold start.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Palette + tokens. Kept tight — corporate-minimal means resist the urge to
// pile on color. One accent, two inks, one muted, one hairline.
// ---------------------------------------------------------------------------

const C = {
  ink: "#0F172A",
  muted: "#64748B",
  hairline: "#E2E8F0",
  accent: "#0A6CFF",
  surface: "#F8FAFC",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.45,
  },

  // ----- header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 10,
    marginBottom: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    borderBottomStyle: "solid",
  },
  wordmark: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: C.ink,
  },
  headerMetaRow: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 0.5,
  },

  // ----- title block
  titleBlock: { marginBottom: 28 },
  eyebrow: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 1.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  preparedFor: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 4,
  },
  preparedForSub: {
    fontSize: 10,
    color: C.muted,
  },

  // ----- public message
  publicMessage: {
    fontSize: 10,
    color: C.muted,
    fontFamily: "Helvetica-Oblique",
    marginBottom: 24,
    maxLines: 3,
    textOverflow: "ellipsis",
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: C.accent,
    borderLeftStyle: "solid",
  },

  // ----- table
  sectionLabel: {
    fontSize: 8,
    color: C.muted,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.ink,
    borderBottomStyle: "solid",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 8,
    color: C.ink,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    borderBottomStyle: "solid",
    alignItems: "flex-start",
  },
  colItem: { flex: 5, paddingRight: 12 },
  colQty: { flex: 1, textAlign: "right", paddingRight: 12 },
  colUnit: { flex: 1.6, textAlign: "right", paddingRight: 12 },
  colTotal: { flex: 1.6, textAlign: "right" },
  itemLabel: { fontSize: 10, color: C.ink },
  itemDescription: {
    fontSize: 8.5,
    color: C.muted,
    marginTop: 2,
  },
  cellNumber: { fontSize: 10, color: C.ink },

  // ----- totals
  totalsBlock: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsCol: { width: 240 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 4,
  },
  totalsRowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    borderTopStyle: "solid",
    marginTop: 4,
    paddingTop: 8,
  },
  totalsLabel: { fontSize: 9, color: C.muted },
  totalsValue: { fontSize: 10, color: C.ink },
  totalsDueLabel: {
    fontSize: 9,
    color: C.ink,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  totalsDueValue: {
    fontSize: 12,
    color: C.ink,
    fontFamily: "Helvetica-Bold",
  },
  totalsDiscountValue: { fontSize: 10, color: C.accent },

  // ----- terms
  terms: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    borderTopStyle: "solid",
  },
  termsLabel: {
    fontSize: 8,
    color: C.muted,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  termsText: { fontSize: 8.5, color: C.muted, lineHeight: 1.55 },

  // ----- footer
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 24,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 7.5,
    color: C.muted,
    letterSpacing: 0.5,
  },

  pageNumber: {
    position: "absolute",
    right: 56,
    bottom: 26,
    fontSize: 7.5,
    color: C.muted,
  },
});

// ---------------------------------------------------------------------------
// Formatters. Kept local — `Intl.NumberFormat` is available on the Vercel
// Node runtime. Cents-in, locale-aware string out.
// ---------------------------------------------------------------------------

function formatMoney(cents: number, currency: string): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code: fall through to USD-style print so the PDF
    // never errors mid-render.
    return `$${value.toFixed(2)}`;
  }
}

function cadenceSuffix(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "MONTHLY") return "/mo";
  if (cadence === "ANNUAL") return "/yr";
  return "";
}

function cadenceWord(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "MONTHLY") return "monthly";
  if (cadence === "ANNUAL") return "annual";
  return "one-time";
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

type Line = ProposalPdfDocumentProps["lineItems"][number];

function TableHeader(): React.ReactElement {
  return (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
      <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
      <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
    </View>
  );
}

function LineRow({
  line,
  currency,
  cadence,
}: {
  line: Line;
  currency: string;
  cadence: "MONTHLY" | "ANNUAL" | null;
}): React.ReactElement {
  const lineTotal = line.unitPriceCents * line.quantity;
  const suffix = line.recurring ? cadenceSuffix(cadence) : "";
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.colItem}>
        <Text style={styles.itemLabel}>{line.label}</Text>
        {line.description ? (
          <Text style={styles.itemDescription}>{line.description}</Text>
        ) : null}
      </View>
      <Text style={[styles.cellNumber, styles.colQty]}>{line.quantity}</Text>
      <Text style={[styles.cellNumber, styles.colUnit]}>
        {formatMoney(line.unitPriceCents, currency)}
        {suffix}
      </Text>
      <Text style={[styles.cellNumber, styles.colTotal]}>
        {formatMoney(lineTotal, currency)}
        {suffix}
      </Text>
    </View>
  );
}

function LineSection({
  label,
  lines,
  currency,
  cadence,
}: {
  label: string;
  lines: Line[];
  currency: string;
  cadence: "MONTHLY" | "ANNUAL" | null;
}): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TableHeader />
      {lines.map((line, idx) => (
        <LineRow
          key={`${label}-${idx}`}
          line={line}
          currency={currency}
          cadence={cadence}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Terms copy. Pure helper so the JSX stays readable. The exact wording
// matters — prospects scan this for the "when am I actually charged?"
// answer, so we lead with it.
// ---------------------------------------------------------------------------

function buildTermsCopy(args: {
  cadence: "MONTHLY" | "ANNUAL" | null;
  hasTrial: boolean;
  trialDays: number;
  firstChargeDate: string | null;
  hasRecurring: boolean;
  hasOneTime: boolean;
  validUntil: string;
  currency: string;
}): string {
  const parts: string[] = [];
  const cadenceText =
    args.cadence === "MONTHLY"
      ? "monthly"
      : args.cadence === "ANNUAL"
        ? "annual"
        : "";

  if (args.hasTrial && args.hasRecurring) {
    parts.push(
      `Your card is collected at checkout to start the ${args.trialDays}-day free trial. ` +
        `${cadenceText ? cadenceText.charAt(0).toUpperCase() + cadenceText.slice(1) : "Recurring"} billing begins${
          args.firstChargeDate ? ` on ${args.firstChargeDate}` : " at trial end"
        } and renews automatically until canceled.`,
    );
  } else if (args.hasRecurring && cadenceText) {
    parts.push(
      `Your card is charged at checkout for the first ${cadenceText} period. ` +
        `${cadenceText.charAt(0).toUpperCase() + cadenceText.slice(1)} billing renews automatically until canceled.`,
    );
  }

  if (args.hasOneTime) {
    parts.push(
      "One-time charges are billed in full at checkout and are non-refundable once delivery has begun.",
    );
  }

  if (args.validUntil) {
    parts.push(
      `This proposal is valid until ${args.validUntil}. After that date the pricing may be re-quoted.`,
    );
  }

  parts.push(
    `All amounts in ${args.currency.toUpperCase()}. Cancel anytime from your billing portal — no long-term commitment.`,
  );

  return parts.join(" ");
}
