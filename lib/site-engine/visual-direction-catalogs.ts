import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Loaders for the three visual-direction catalogs that ship from
// site-engine-kit into LeaseStack's public/ directory. The kit regenerates
// the INDEX.json files via its own scripts (palettes/_build.mjs,
// design-languages/_classify.mjs); after a kit update, copy the JSON files
// over from site-engine-kit/{palettes,design-languages}/INDEX.json into
// public/site-engine/{palettes,design-languages}-index.json. The intake form
// (server component) calls these loaders; the result is passed to the
// client-side picker UI as initial props.
//
// Why public/ (instead of importing as a build-time module)?
//   - Decouples LeaseStack from the kit at the type level
//   - Lets us swap the kit version without code changes
//   - Same JSON is fetchable by the form's JS for client-side filtering
// ---------------------------------------------------------------------------

const BASE = join(process.cwd(), "public", "site-engine");

interface DesignLanguageEntry {
  slug: string;
  name: string;
  filePath: string;
  description: string;
  category: string;
  colorPhilosophy: string | null;
  typography: string | null;
  motion: string | null;
  bestFor: string[];
  sampleColors: { primary: string | null; canvas: string | null };
  thumbnailReference: string | null;
}

export interface DesignLanguageIndex {
  schemaVersion: number;
  generatedAt: string;
  totalCount: number;
  classifiedCount: number;
  categories: string[];
  colorPhilosophies: string[];
  designLanguages: DesignLanguageEntry[];
}

interface PaletteEntry {
  slug: string;
  name: string;
  description: string;
  category: string;
  industryFit: string[];
  previewImage: string;
  colors: { background: string; primary: string; accent: string };
  wcagAACompliant: boolean;
}

export interface PaletteIndex {
  schemaVersion: number;
  generatedAt: string;
  totalCount: number;
  wcagAACompliantCount: number;
  categories: string[];
  industryFits: string[];
  palettes: PaletteEntry[];
}

interface PresetEntry {
  slug: string;
  displayName: string;
  description: string;
  tone: string;
  bestFor: string[];
  fonts: unknown;
  designLanguageSlug: string | null;
}

export interface PresetIndex {
  schemaVersion: number;
  generatedAt: string;
  totalCount: number;
  presets: PresetEntry[];
}

async function readJson<T>(filename: string): Promise<T | null> {
  try {
    const buf = await readFile(join(BASE, filename), "utf8");
    return JSON.parse(buf) as T;
  } catch (err) {
    console.warn(`[visual-direction-catalogs] failed to load ${filename}:`, err);
    return null;
  }
}

export async function loadDesignLanguageIndex(): Promise<DesignLanguageIndex> {
  return (
    (await readJson<DesignLanguageIndex>("design-languages-index.json")) ?? {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      totalCount: 0,
      classifiedCount: 0,
      categories: [],
      colorPhilosophies: [],
      designLanguages: [],
    }
  );
}

export async function loadPaletteIndex(): Promise<PaletteIndex> {
  return (
    (await readJson<PaletteIndex>("palettes-index.json")) ?? {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      totalCount: 0,
      wcagAACompliantCount: 0,
      categories: [],
      industryFits: [],
      palettes: [],
    }
  );
}

export async function loadPresetIndex(): Promise<PresetIndex> {
  return (
    (await readJson<PresetIndex>("presets-index.json")) ?? {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      totalCount: 0,
      presets: [],
    }
  );
}
