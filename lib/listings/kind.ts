// What an advertised AppFolio listing actually rents: a bed or room in a
// shared unit, a whole apartment or studio, or something that is not a
// home at all (parking, storage, commercial). SG mixes all of these in one
// building (Southgate Annex: a $748 bed and a $9,995 five-bedroom flat), so
// a single rent range or unit count across them is meaningless.
//
// AppFolio has no field for this; the unit name and marketing title carry
// it. Unit name wins over title because titles describe the building too
// ("Large Furnished Apartments" on a Wesley House triple room).

export type ListingKind = "room" | "unit" | "other";

type ListingText = { unitNumber?: string | null; unitType?: string | null; raw?: unknown };

const OTHER = /\b(parking|garage|storage|commercial|retail|office suite)\b/i;
// "302 - C2", "410 - B" (bed letter), "307B", "401A", "Room 3 Bed B", "Double",
// "Triple". "2-bed" / "1 Bed" is a bedroom count (whole unit), not a bed.
const ROOM_NAME = /\b(room|double|triple|quad|private bedroom)\b|(?<!\d[\s-]?)\bbed\b|^\s*\d+\s*-\s*[a-z]\d?\s*$|^\s*\d+[a-z]\s*$/i;
// "Single" is a private room, except "Single Occupancy" (a private studio).
const SINGLE = /\bsingle\b(?!\s+occupancy)/i;
const PRIVATE_STUDIO = /\bprivate\s+(\w+\s+)?studio/i;
const ROOM_TITLE = /\bshared\b|\b(single|private|double|triple)\s+(xl\s+)?room\b|rent[\s-]by[\s-]the[\s-]bed|\bbed available\b/i;

export function listingTitle(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const t = (raw as Record<string, unknown>).marketing_title;
  return typeof t === "string" ? t : "";
}

function billedAsCommercial(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const b = (raw as Record<string, unknown>).billed_as;
  return typeof b === "string" && /commercial/i.test(b);
}

export function listingKind(l: ListingText): ListingKind {
  const name = `${l.unitNumber ?? ""} ${l.unitType ?? ""}`;
  const title = listingTitle(l.raw);
  if (billedAsCommercial(l.raw) || OTHER.test(name)) return "other"; // not title: "Free storage until August!"
  if (ROOM_NAME.test(name) || SINGLE.test(name)) return "room";
  if (/studio/i.test(name) || PRIVATE_STUDIO.test(title)) return "unit";
  if (ROOM_TITLE.test(title)) return "room";
  return "unit";
}

export type KindRange = { count: number; min: number | null; max: number | null };
export type RentByKind = { room: KindRange; unit: KindRange; other: KindRange };

/** Count and advertised-rent range (cents) per kind. Rents under $100 are placeholders. */
export function rentByKind(listings: (ListingText & { priceCents: number | null })[]): RentByKind {
  const out: RentByKind = {
    room: { count: 0, min: null, max: null },
    unit: { count: 0, min: null, max: null },
    other: { count: 0, min: null, max: null },
  };
  for (const l of listings) {
    const r = out[listingKind(l)];
    r.count += 1;
    const c = l.priceCents;
    if (typeof c !== "number" || c < 10_000) continue;
    r.min = r.min === null ? c : Math.min(r.min, c);
    r.max = r.max === null ? c : Math.max(r.max, c);
  }
  return out;
}
