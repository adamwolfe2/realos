import { prisma } from "../lib/db";

// ---------------------------------------------------------------------------
// Backfill the structured PropertyKnowledgeBase for Telegraph Commons.
//
// Source: AppFolio unit_directory (prop 223) — unit_name room types + per-unit
// market_rent/legal_rent, plus the operator's own marketing_description pricing
// block ("Triples start $850, Doubles $995, Singles $1495-$1550, XL Deluxe
// Singles $1695"). Every value below is lifted from that AppFolio data — NONE
// invented. Run: pnpm exec tsx --env-file=.env.production.local \
//   scripts/backfill-telegraph-knowledge-base.ts
// ---------------------------------------------------------------------------

const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h";
const ORG_ID = "cmo402dwz0002c93lf3okkgi0";

const floorPlans = [
  {
    type: "Triple (shared room, same-gender)",
    bedrooms: null,
    bathrooms: null,
    squareFeet: 420,
    priceMinCents: 85000, // $850 start (marketing_description)
    priceMaxCents: null,
    notes: "Per-person rate. Same-gender shared room, fully furnished, shared floor bathroom.",
  },
  {
    type: "Double (shared room, same-gender)",
    bedrooms: null,
    bathrooms: null,
    squareFeet: 420,
    priceMinCents: 99500, // $995 start
    priceMaxCents: null,
    notes: "Per-person rate. Same-gender shared room, fully furnished, shared floor bathroom.",
  },
  {
    type: "Single (private room)",
    bedrooms: null,
    bathrooms: null,
    squareFeet: 150,
    priceMinCents: 149500, // $1,495
    priceMaxCents: 155000, // $1,550
    notes: "Private furnished room. Shared floor kitchen and bathroom.",
  },
  {
    type: "XL Deluxe Single (private room)",
    bedrooms: null,
    bathrooms: null,
    squareFeet: 170,
    priceMinCents: 169500, // $1,695
    priceMaxCents: null,
    notes: "Upgraded extra-large private furnished room. Shared floor kitchen and bathroom.",
  },
];

const data = {
  floorPlans: floorPlans as unknown as object,
  communityAmenities: [
    "Community kitchen on each floor",
    "Large communal bathrooms (one private bathroom per floor)",
    "Washer and dryer on each floor",
    "Study lounges",
    "Berkeley shuttle right outside",
    "Two blocks from UC Berkeley",
    "Onsite janitorial team",
    "Onsite community managers",
  ],
  unitAmenities: [
    "Fully furnished (twin bed, desk, chair, closet, mini-fridge)",
    "In-room Google Fiber wifi",
  ],
  petPolicy: "No pets at this location due to shared common spaces.",
  parkingInfo:
    "No on-site parking. Ask the leasing office about parking spaces that may be available at nearby SG Real Estate buildings.",
  laundryInfo: "Washer and dryer on each floor.",
  utilitiesIncluded:
    "Flat $85/month amenity fee per person covers all utilities (water, garbage, trash), building amenities, common-area cleaning, and in-room Google Fiber wifi.",
  smokingPolicy: null,
  leaseTerms:
    "Short-term leases available to align with your travel or academic calendar. 2026-2027 availability open.",
  depositInfo:
    "First month's rent plus security deposit to move in (default security deposit $500).",
  currentSpecials: null,
  applicationProcess:
    "Apply online at telegraphcommons.com. Easy application with an international-student option and instant approval.",
  applicationRequirements:
    "International students may enter 111-11-1111 for SSN and use a current or international address for rental references.",
  neighborhoodInfo:
    "In the heart of Berkeley on Telegraph Avenue, two blocks from the UC Berkeley campus, surrounded by restaurants and shopping.",
  transitInfo: "Berkeley shuttle stops right outside the building.",
  tourInfo:
    "Book a tour via Calendly (weekday and weekend links). Contact CJ at (408) 560-7240 or leasing@sgrealestateco.com / (510) 704-1240.",
  additionalNotes:
    "Private rooms do not include a private bathroom; bathrooms are shared by floor (one private bathroom per floor). Rooms come furnished with a twin bed, desk, chair, closet, and mini-fridge.",
};

async function main() {
  // Guard: confirm the property belongs to the expected org (tenant safety).
  const prop = await prisma.property.findFirst({
    where: { id: PROPERTY_ID, orgId: ORG_ID },
    select: { id: true, name: true },
  });
  if (!prop) throw new Error("Telegraph Commons not found under expected org");

  const kb = await prisma.propertyKnowledgeBase.upsert({
    where: { propertyId: PROPERTY_ID },
    update: data,
    create: { ...data, propertyId: PROPERTY_ID, orgId: ORG_ID },
  });
  console.log(`Backfilled KB for ${prop.name} (kb id ${kb.id})`);
  console.log(`Floor plans: ${floorPlans.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
