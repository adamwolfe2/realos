// A draft generation runs inline in one request (8-15s). If the function is
// killed mid-run, the catch that rolls it to REJECTED never fires and the row
// sits in GENERATING forever (SG: 8 drafts since 2026-05-21). Display-only:
// such rows read as "stalled", not "in progress". No reaper writes the DB.
export const DRAFT_STALL_MS = 24 * 60 * 60 * 1000;

export function isStalledDraft(
  d: { status: string; updatedAt: Date },
  now: Date = new Date(),
): boolean {
  return d.status === "GENERATING" && now.getTime() - d.updatedAt.getTime() > DRAFT_STALL_MS;
}
