import { describe, it, expect } from "vitest";
import {
  computeDefaultOpen,
  computeSummaryText,
  type ReportStatus,
} from "@/lib/reports/operator-bar-state";

// ---------------------------------------------------------------------------
// Truth tables for the OperatorReviewBar state functions. The bar is the
// operator's primary surface on the report-editor page; getting the
// "should this be open?" or "what does it say next to the pill?" wrong
// turns the bar into a UX dead end.
// ---------------------------------------------------------------------------

describe("computeDefaultOpen", () => {
  it("draft + no headline + no notes → OPEN (operator's primary CTA)", () => {
    expect(computeDefaultOpen("draft", false, false)).toBe(true);
  });

  it("draft + headline only → closed (operator wrote something already)", () => {
    expect(computeDefaultOpen("draft", true, false)).toBe(false);
  });

  it("draft + notes only → closed", () => {
    expect(computeDefaultOpen("draft", false, true)).toBe(false);
  });

  it("draft + both → closed", () => {
    expect(computeDefaultOpen("draft", true, true)).toBe(false);
  });

  it("shared → always closed regardless of headline/notes", () => {
    expect(computeDefaultOpen("shared", false, false)).toBe(false);
    expect(computeDefaultOpen("shared", true, true)).toBe(false);
  });

  it("archived → always closed", () => {
    expect(computeDefaultOpen("archived", false, false)).toBe(false);
    expect(computeDefaultOpen("archived", true, true)).toBe(false);
  });
});

describe("computeSummaryText", () => {
  const draft = (hasHeadline: boolean, hasNotes: boolean) =>
    computeSummaryText("draft" as ReportStatus, hasHeadline, hasNotes, null);

  it("shared + shareUrl → 'live with your client'", () => {
    expect(
      computeSummaryText("shared", true, true, "https://leasestack.co/r/abc"),
    ).toBe("Report is live with your client");
  });

  it("shared without shareUrl → 'marked shared' fallback", () => {
    expect(computeSummaryText("shared", true, true, null)).toBe(
      "Report marked shared",
    );
  });

  it("archived → 'archived from active reports'", () => {
    expect(computeSummaryText("archived", false, false, null)).toBe(
      "Archived from active reports",
    );
  });

  it("draft + neither → 'add a headline and a personal note'", () => {
    expect(draft(false, false)).toBe(
      "Add a headline and a personal note before you share",
    );
  });

  it("draft + notes only → 'add a headline'", () => {
    expect(draft(false, true)).toBe("Add a headline before you share");
  });

  it("draft + headline only → 'add a personal note'", () => {
    expect(draft(true, false)).toBe("Add a personal note before you share");
  });

  it("draft + both → ready to share", () => {
    expect(draft(true, true)).toBe(
      "Ready to share — review and send to your client",
    );
  });

  it("every branch returns a non-empty string", () => {
    const statuses: ReportStatus[] = ["draft", "shared", "archived"];
    for (const status of statuses) {
      for (const hasHeadline of [false, true]) {
        for (const hasNotes of [false, true]) {
          for (const shareUrl of [null, "https://example.com/r/x"]) {
            const out = computeSummaryText(
              status,
              hasHeadline,
              hasNotes,
              shareUrl,
            );
            expect(out.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
