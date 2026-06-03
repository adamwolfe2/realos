import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Human-friendly proposal number generator: `P-2026-NNN`.
//
// NNN is sequential per calendar year (resets Jan 1).
//
// review-fix: switched from `count() + 1` to `findFirst(orderBy: desc) + 1`.
// The count approach was race-prone (two drafts in the same tick computed
// the same N) and structurally wrong: deleting an in-flight draft shifted
// the count down, freeing the prior number to be re-issued — when the
// unique index later observed a collision it had no safe re-roll path.
// The max-based approach derives the next number from the actual highest
// existing number, which is monotonically increasing regardless of how
// many drafts get deleted along the way. Callers (createDraft / duplicate)
// still wrap insertion in a unique-violation retry, but the retry now
// produces a FRESH higher number on each pass instead of the same one.
// ---------------------------------------------------------------------------

export async function generateProposalNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `P-${year}-`;

  // Find the highest existing number for this year, if any. `orderBy:
  // number desc` works because the prefix is fixed-width and the suffix
  // is zero-padded — string-sort order = numeric order.
  const last = await prisma.proposal.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  let nextSeq = 1;
  if (last) {
    const suffix = last.number.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}
