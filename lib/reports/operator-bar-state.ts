// ---------------------------------------------------------------------------
// operator-bar-state
//
// Pure decision functions for the OperatorReviewBar component. Extracted so
// the truth tables can be tested without spinning up React/JSDOM. Keeping
// the component free of branching logic also makes the visual layer easier
// to scan.
// ---------------------------------------------------------------------------

export type ReportStatus = "draft" | "shared" | "archived";

/**
 * Should the operator-review panel auto-expand on first paint?
 *
 *   - draft + no headline + no notes → YES (operator hasn't personalized
 *     yet; the panel is their primary CTA)
 *   - draft + at least one of headline/notes → no (operator is reviewing,
 *     they wrote something; don't shove a giant form in their face)
 *   - shared / archived → no (the report is the deliverable; the bar is
 *     just a status surface)
 */
export function computeDefaultOpen(
  status: ReportStatus,
  hasHeadline: boolean,
  hasNotes: boolean,
): boolean {
  return status === "draft" && !hasHeadline && !hasNotes;
}

/**
 * One-line summary rendered next to the status pill. The text answers
 * "what should the operator do next?" rather than restating status —
 * status is already in the pill.
 */
export function computeSummaryText(
  status: ReportStatus,
  hasHeadline: boolean,
  hasNotes: boolean,
  shareUrl: string | null,
): string {
  if (status === "shared") {
    return shareUrl
      ? "Report is live with your client"
      : "Report marked shared";
  }
  if (status === "archived") return "Archived from active reports";
  // draft branch — three sub-cases for what's missing.
  if (!hasHeadline && !hasNotes) {
    return "Add a headline and a personal note before you share";
  }
  if (!hasHeadline) return "Add a headline before you share";
  if (!hasNotes) return "Add a personal note before you share";
  return "Ready to share — review and send to your client";
}
