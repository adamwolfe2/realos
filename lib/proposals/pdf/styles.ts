import { StyleSheet } from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Proposal PDF — palette + StyleSheet.
//
// Tight palette by design: one accent, two inks, one muted, one hairline.
// Corporate-minimal means resist the urge to pile on color. Every additional
// color = additional design debt across email + share page + PDF.
// ---------------------------------------------------------------------------

export const C = {
  ink: "#0F172A",
  muted: "#64748B",
  hairline: "#E2E8F0",
  accent: "#0A6CFF",
  surface: "#F8FAFC",
} as const;

export const styles = StyleSheet.create({
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
  titleBlock: { marginBottom: 32 },
  eyebrow: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 1.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  preparedFor: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 6,
    lineHeight: 1.25,
  },
  preparedForSub: {
    fontSize: 10,
    color: C.muted,
    lineHeight: 1.4,
  },

  // ----- public message
  publicMessage: {
    fontSize: 10,
    color: C.muted,
    fontFamily: "Helvetica-Oblique",
    marginBottom: 28,
    lineHeight: 1.55,
    maxLines: 3,
    textOverflow: "ellipsis",
    paddingLeft: 12,
    paddingTop: 2,
    paddingBottom: 2,
    borderLeftWidth: 1,
    borderLeftColor: C.accent,
    borderLeftStyle: "solid",
  },

  // ----- scope of work
  scopeBlock: { marginBottom: 24 },
  scopeText: {
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.55,
  },

  // ----- timeline
  timelineBlock: { marginBottom: 24 },
  timelinePhaseRow: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    borderBottomStyle: "solid",
    alignItems: "flex-start",
  },
  timelinePhaseCol: { flex: 3, paddingRight: 12 },
  timelineWeeksCol: { flex: 1.4, paddingRight: 12 },
  timelineDeliverablesCol: { flex: 5 },
  timelinePhaseName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },
  timelineWeeks: {
    fontSize: 10,
    color: C.muted,
  },
  timelineDeliverableItem: {
    fontSize: 9.5,
    color: C.ink,
    lineHeight: 1.5,
    marginBottom: 2,
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

  // ----- Accept & Pay CTA block. Compact pay-strip rendered after the
  // totals (mirrors a tear-off pay band on a paper invoice). Two
  // columns: copy + URL on the left, QR code on the right.
  acceptBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    padding: 12,
    borderRadius: 6,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.hairline,
    borderStyle: "solid",
  },
  acceptCol: {
    flex: 1,
    paddingRight: 14,
  },
  acceptEyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    marginBottom: 4,
  },
  acceptHint: {
    fontSize: 8.5,
    color: C.muted,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  acceptLinkUrl: {
    fontSize: 9,
    color: C.accent,
    fontFamily: "Helvetica-Bold",
  },
  acceptQrCol: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 12,
    borderLeftWidth: 0.5,
    borderLeftColor: C.hairline,
    borderLeftStyle: "solid",
  },
  acceptQrImage: {
    width: 54,
    height: 54,
  },
  acceptQrCaption: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 4,
    letterSpacing: 0.5,
    textAlign: "center",
  },

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
