#!/usr/bin/env node
// Sync the site-engine-kit's design-language + palette payloads into
// LeaseStack's public/ folder so the build packet endpoint can include
// them in zips at runtime, regardless of whether the kit is checked out
// next to the LeaseStack repo (works locally + in Vercel prod).
//
// Total payload ~2.7MB (71 design-language MDs + 36 palette JSONs +
// 3 INDEX.json catalogs). Small enough to commit — saves a runtime fetch
// or a separate build-time download step.
//
// Run after the kit's _classify.mjs / _build.mjs scripts regenerate their
// INDEX.json files. Idempotent — overwrites existing files in
// public/site-engine/data/.
//
//   node scripts/sync-site-engine-data.mjs
//
// To target a non-default kit path:
//   node scripts/sync-site-engine-data.mjs --kit=/path/to/site-engine-kit
import { cp, mkdir, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

function parseArgs() {
  const args = { kit: join(REPO_ROOT, "..", "site-engine-kit") };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--kit=")) args.kit = a.slice("--kit=".length);
  }
  return args;
}

async function main() {
  const { kit } = parseArgs();

  if (!existsSync(kit)) {
    console.error(`Error: kit not found at ${kit}`);
    console.error(`Pass --kit=/path/to/site-engine-kit to override.`);
    process.exit(1);
  }

  const dest = join(REPO_ROOT, "public", "site-engine", "data");
  await mkdir(join(dest, "design-languages"), { recursive: true });
  await mkdir(join(dest, "palettes", "previews"), { recursive: true });

  // Design languages — every <slug>.md from the kit. We DON'T copy the
  // <slug>.README.md files (used internally in the kit but not by builds).
  const dlSrc = join(kit, "design-languages");
  const dlFiles = await readdir(dlSrc);
  let dlCount = 0;
  for (const file of dlFiles) {
    // Only the canonical DESIGN.md files — skip READMEs, indexer, root readme
    if (!file.endsWith(".md")) continue;
    if (file.endsWith(".README.md")) continue;
    if (file === "README.md") continue;
    await copyFile(join(dlSrc, file), join(dest, "design-languages", file));
    dlCount++;
  }

  // Design language INDEX.json — bundled alongside (the bundled catalog
  // at public/site-engine/design-languages-index.json is the form-facing
  // copy; this `data/` one is the build-packet copy so both update in sync).
  await copyFile(
    join(dlSrc, "INDEX.json"),
    join(dest, "design-languages", "INDEX.json"),
  );

  // Palettes — JSON per slug + SVG previews + INDEX.json.
  const palSrc = join(kit, "palettes");
  const palFiles = await readdir(palSrc);
  let palCount = 0;
  for (const file of palFiles) {
    if (file.endsWith(".json") && file !== "INDEX.json") {
      await copyFile(join(palSrc, file), join(dest, "palettes", file));
      palCount++;
    }
  }
  await copyFile(
    join(palSrc, "INDEX.json"),
    join(dest, "palettes", "INDEX.json"),
  );

  // Preview SVGs
  const previewsSrc = join(palSrc, "previews");
  if (existsSync(previewsSrc)) {
    const previews = await readdir(previewsSrc);
    for (const file of previews) {
      if (file.endsWith(".svg")) {
        await copyFile(
          join(previewsSrc, file),
          join(dest, "palettes", "previews", file),
        );
      }
    }
  }

  // Manifest stamp — for debugging / cache invalidation.
  const manifest = {
    syncedAt: new Date().toISOString(),
    kitSource: kit,
    designLanguageCount: dlCount,
    paletteCount: palCount,
  };
  await writeFile(
    join(dest, "MANIFEST.json"),
    JSON.stringify(manifest, null, 2),
  );

  const destStat = await readdir(dest);
  console.log(`✓ Synced from ${kit}`);
  console.log(`  design-languages/ : ${dlCount} MDs + INDEX.json`);
  console.log(`  palettes/         : ${palCount} JSONs + INDEX.json + previews/`);
  console.log(`  Top-level entries : ${destStat.join(", ")}`);
  console.log(`  Run after kit changes; commit the resulting public/ updates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
