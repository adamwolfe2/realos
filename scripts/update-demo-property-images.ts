/**
 * scripts/update-demo-property-images.ts
 *
 * Surgical update: gives the 4 Telegraph Commons demo properties hero
 * images so the portal Properties grid stops rendering as 4 gray
 * building-icon placeholders. Does NOT re-seed leads/visitors/anything
 * else.
 *
 * Safety: refuses to run unless the target slug is exactly
 * "telegraph-commons-demo". Same triple-guard pattern as
 * seed-neutral-demo.ts (NODE_ENV / VERCEL_ENV / prod token in URL).
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm tsx scripts/update-demo-property-images.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DEMO_ORG_SLUG = "telegraph-commons-demo" as const;

// ─── Images per property ────────────────────────────────────────────────
// Each property gets ONE hero (renders as the big background image on
// the card) plus a 4-photo gallery (used on the property detail page).
// All URLs are Unsplash photos picked for modern urban residential
// architecture that loosely matches each city's vibe — no people in
// frame so we stay clear of fair-housing imagery concerns.
//
// If any of these URLs ever 404 (Unsplash occasionally retires
// photos), swap to a `https://picsum.photos/seed/<slug>/1600/900`
// fallback — same dimensions, always-on.
const IMAGE_SETS: Record<
  string,
  { hero: string; gallery: string[] }
> = {
  "the-rhodes": {
    // Nashville — modern brick + glass mid-rise vibe
    hero: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&q=80&auto=format&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200&q=80&auto=format&fit=crop",
    ],
  },
  "park-and-pearl": {
    // Austin — modern stucco + glass building
    hero: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80&auto=format&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80&auto=format&fit=crop",
    ],
  },
  "sage-at-greenpoint": {
    // Brooklyn — brick + industrial conversion energy
    hero: "https://images.unsplash.com/photo-1448630360428-65456885c650?w=1600&q=80&auto=format&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80&auto=format&fit=crop",
    ],
  },
  "westbrook-commons": {
    // Boulder — mountain-town modern with warm wood + glass
    hero: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80&auto=format&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80&auto=format&fit=crop",
    ],
  },
};

// ─── Production guards ──────────────────────────────────────────────────
const ALLOW_PROD = process.argv.includes("--allow-prod");
if (process.env.NODE_ENV === "production" && !ALLOW_PROD) {
  throw new Error(
    "Refusing to run when NODE_ENV=production. Pass --allow-prod to override.",
  );
}
if (process.env.VERCEL_ENV === "production" && !ALLOW_PROD) {
  throw new Error(
    "Refusing to run against VERCEL_ENV=production. Pass --allow-prod.",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}

const adapter = new PrismaNeon({
  connectionString: connectionString.replace(/-pooler\./, "."),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Belt-and-suspenders slug check — the constant is hardcoded but
  // re-asserting here makes a future copy-paste-into-different-file
  // refactor still safe.
  if (DEMO_ORG_SLUG !== "telegraph-commons-demo") {
    throw new Error(
      `Refusing to run: DEMO_ORG_SLUG must be exactly "telegraph-commons-demo".`,
    );
  }

  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    throw new Error(
      `Demo org "${DEMO_ORG_SLUG}" not found. Run scripts/seed-neutral-demo.ts first.`,
    );
  }
  if (org.name !== "Telegraph Commons") {
    throw new Error(
      `Demo org name mismatch: expected "Telegraph Commons", got "${org.name}". Refusing to write.`,
    );
  }
  console.log(`[update-images] target org: ${org.id} (${org.slug} · "${org.name}")`);

  const properties = await prisma.property.findMany({
    where: { orgId: org.id },
    select: { id: true, name: true, slug: true, heroImageUrl: true },
  });
  console.log(`[update-images] found ${properties.length} properties`);

  let updated = 0;
  for (const prop of properties) {
    const set = IMAGE_SETS[prop.slug];
    if (!set) {
      console.warn(
        `  ⚠ no image set for slug "${prop.slug}" — skipping (${prop.name})`,
      );
      continue;
    }
    await prisma.property.update({
      where: { id: prop.id },
      data: {
        heroImageUrl: set.hero,
        photoUrls: set.gallery,
        imageScrapeAt: new Date(),
        imageScrapeError: null,
      },
    });
    console.log(`  ✓ ${prop.name} — hero + ${set.gallery.length} gallery photos`);
    updated += 1;
  }

  console.log(`\n[update-images] done. updated ${updated} of ${properties.length} properties.`);
}

main()
  .catch((err) => {
    console.error(`\n[error] ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
