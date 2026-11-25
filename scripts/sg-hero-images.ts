// Set each SG property's hero image from its live site's hero photo: the
// same photo the chatbot KB names (scripts/sg-kb/<slug>.md `hero:`), on the
// site host (`site:` in the KB, else Property.websiteUrl). Only fills an
// empty heroImageUrl; every URL is fetched first and must be a 200 image.
//
//   pnpm exec tsx scripts/sg-hero-images.ts            # dry run
//   pnpm exec tsx scripts/sg-hero-images.ts --apply
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SG_ORG = "cmo402dwz0002c93lf3okkgi0";
const KB_DIR = join(__dirname, "sg-kb");
const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {}) });

const field = (md: string, k: string) => md.match(new RegExp(`^${k}:\\s*(\\S+)`, "m"))?.[1] ?? null;

async function main() {
  const kb = readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const md = readFileSync(join(KB_DIR, f), "utf8");
      return { slug: f.replace(/\.md$/, ""), hero: field(md, "hero"), site: field(md, "site") };
    });
  const props = await prisma.property.findMany({
    where: { orgId: SG_ORG, slug: { in: kb.map((k) => k.slug) } },
    select: { id: true, slug: true, name: true, websiteUrl: true, heroImageUrl: true },
  });
  let changed = 0;
  for (const k of kb) {
    const p = props.find((x) => x.slug === k.slug);
    if (!p) { console.log(`skip ${k.slug}: no SG property with this slug`); continue; }
    if (p.heroImageUrl) { console.log(`keep ${p.name}: hero already set`); continue; }
    const base = k.site ?? p.websiteUrl;
    if (!k.hero || !base) { console.log(`skip ${p.name}: no hero path or site`); continue; }
    const url = new URL(k.hero, base).toString();
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    await res.body?.cancel();
    if (!res.ok || !type.startsWith("image/")) { console.log(`FAIL ${p.name}: ${url} -> ${res.status} ${type}`); continue; }
    console.log(`${apply ? "set " : "would set"} ${p.name}: ${url} (${res.status} ${type})`);
    if (apply) {
      // Guarded write: never overwrite a hero set since the read above.
      const r = await prisma.property.updateMany({ where: { id: p.id, heroImageUrl: null }, data: { heroImageUrl: url } });
      changed += r.count;
    }
  }
  console.log(apply ? `updated ${changed}` : "dry run: pass --apply to write");
}

main()
  .catch((err) => {
    console.error("[sg-hero-images] failed", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
